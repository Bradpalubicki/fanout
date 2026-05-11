/**
 * Bluesky (AT Protocol) account creation — fully automated, 7 steps.
 *
 * Flow:
 *   1. generateHandle — slug + collision handling (up to 10 attempts)
 *   2. createBlueskyAccount — POST bsky.social/xrpc/com.atproto.server.createAccount
 *   3. createAppPassword — POST com.atproto.server.createAppPassword (scoped cred)
 *   4. storeCredentials — encrypt + upsert to oauth_tokens
 *   5. linkProfile — insert/update profiles row
 *   6. verifyPosting — create test post, then delete it
 *   7. Return result
 */

import { supabase } from '@/lib/supabase'
import { encryptToken } from '@/lib/crypto'
import type { AccountCreationInput, AccountCreationResult } from '../types'

const BSKY_PDS = 'https://bsky.social'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 18)
}

async function generateHandle(baseSlug: string): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? baseSlug : `${baseSlug}${i}`
    const res = await fetch(
      `${BSKY_PDS}/xrpc/com.atproto.identity.resolveHandle?handle=${candidate}.bsky.social`,
    )
    if (res.status === 400 || res.status === 404) {
      // Handle not taken
      return `${candidate}.bsky.social`
    }
  }
  return null
}

interface BskyCreateAccountResponse {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

async function createBlueskyAccount(
  handle: string,
  email: string,
  password: string,
): Promise<BskyCreateAccountResponse> {
  const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createAccount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, handle, password }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`createAccount failed ${res.status}: ${body}`)
  }
  return res.json() as Promise<BskyCreateAccountResponse>
}

async function createAppPassword(
  accessJwt: string,
  name: string,
): Promise<string> {
  const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createAppPassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`createAppPassword failed ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { password: string }
  return data.password
}

async function verifyPosting(handle: string, appPassword: string): Promise<void> {
  // Authenticate with app password
  const authRes = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  })
  if (!authRes.ok) throw new Error('App password auth failed during verify step')
  const { accessJwt, did } = (await authRes.json()) as { accessJwt: string; did: string }

  // Create test post
  const now = new Date().toISOString()
  const createRes = await fetch(`${BSKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: { text: '🔧 Fanout account setup test — deleting now', createdAt: now },
    }),
  })
  if (!createRes.ok) throw new Error('Test post creation failed during verify step')
  const { uri } = (await createRes.json()) as { uri: string }

  // Extract rkey from uri (at://did:.../app.bsky.feed.post/rkey)
  const rkey = uri.split('/').pop()!
  await fetch(`${BSKY_PDS}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', rkey }),
  })
}

export async function createBlueskyAccountForOrg(
  input: AccountCreationInput,
): Promise<AccountCreationResult> {
  const platform = 'bluesky'
  const baseSlug = toSlug(input.clientName)

  try {
    // Step 1 — generate unique handle
    const handle = await generateHandle(baseSlug)
    if (!handle) {
      return { platform, success: false, error: 'Could not find available handle after 10 attempts' }
    }

    // Step 2 — create account with temporary strong password
    const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!'
    const { did, accessJwt } = await createBlueskyAccount(handle, input.clientEmail, tempPassword)

    // Step 3 — create scoped app password (discard main password after this)
    const appPassword = await createAppPassword(accessJwt, 'fanout-publisher')

    // Step 4 — encrypt and store in oauth_tokens
    const encryptedToken = await encryptToken(appPassword)

    const { error: tokenError } = await supabase.from('oauth_tokens').upsert(
      {
        profile_id: null, // linked in step 5
        platform,
        access_token: encryptedToken,
        platform_user_id: did,
        platform_username: handle,
        platform_handle: handle,
        is_active: true,
        scopes: ['app.bsky.feed.post'],
      },
      { onConflict: 'platform_user_id' },
    )
    if (tokenError) throw new Error(`oauth_tokens upsert failed: ${tokenError.message}`)

    // Step 5 — ensure profile row exists for this org
    const slug = baseSlug + '-' + Math.random().toString(36).slice(2, 6)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({ org_id: input.orgId, name: input.clientName, slug }, { onConflict: 'org_id' })
      .select('id')
      .single()
    if (profileError) throw new Error(`profiles upsert failed: ${profileError.message}`)

    // Link token to profile
    await supabase
      .from('oauth_tokens')
      .update({ profile_id: profile.id })
      .eq('platform_user_id', did)

    // Step 6 — verify posting capability
    await verifyPosting(handle, appPassword)

    // Step 7 — log success
    await supabase.from('account_creation_log').insert({
      org_id: input.orgId,
      platform,
      status: 'success',
      handle,
      platform_did: did,
    })

    return { platform, success: true, handle, platformId: did }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)

    await supabase.from('account_creation_log').insert({
      org_id: input.orgId,
      platform,
      status: 'failed',
      error,
    })

    return { platform, success: false, error }
  }
}
