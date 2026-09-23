export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { generateApiKey, hashApiKey } from '@/lib/crypto'
import { checkProfileLimit, getOrCreateOrgSubscription } from '@/lib/subscriptions'

/**
 * Agency-engine provisioning API (BUILD.md:846-855, 1023).
 *
 * Machine route: the caller is another NuStack engine, not a browser, so it
 * authenticates with FANOUT_ADMIN_KEY and passes the target orgId in the body.
 * This is the ONLY route where orgId comes from input rather than the session —
 * that is the whole point of provisioning on behalf of a client, and it is why
 * the admin-key check below must be airtight.
 *
 * /api/v1 is deliberately excluded from the Clerk matcher (src/proxy.ts), so
 * this handler's own check is the only gate. There is no middleware behind it.
 */

const CreateProfileSchema = z.object({
  orgId: z.string().min(1).max(200),
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  timezone: z.string().max(64).default('UTC'),
})

/**
 * Constant-time compare so a wrong key cannot be recovered byte-by-byte from
 * response timing. Requires a NON-EMPTY configured key: comparing directly
 * against process.env fails OPEN when the var is unset (undefined === undefined).
 */
function isAuthorized(authHeader: string | null): boolean {
  const adminKey = process.env.FANOUT_ADMIN_KEY
  if (!adminKey || !authHeader?.startsWith('Bearer ')) return false

  const presented = Buffer.from(authHeader.slice(7))
  const expected = Buffer.from(adminKey)
  if (presented.length !== expected.length) return false

  return timingSafeEqual(presented, expected)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { orgId, name, slug, webhookUrl, timezone } = parsed.data

  // Same plan gate as the dashboard route: provisioning through the API must
  // not be a way around a client's profile limit or an expired trial.
  const limitCheck = await checkProfileLimit(orgId)
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitCheck.paywalled
          ? 'Trial expired or subscription inactive. Upgrade to create profiles.'
          : `Profile limit reached. The ${limitCheck.plan} plan allows ${limitCheck.limit} profile${limitCheck.limit !== 1 ? 's' : ''}.`,
        paywall: true,
        limit: limitCheck.limit,
        current: limitCheck.current,
        plan: limitCheck.plan,
      },
      { status: 402 }
    )
  }

  if (limitCheck.current === 0) {
    await getOrCreateOrgSubscription(orgId)
  }

  const apiKey = generateApiKey()

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      org_id: orgId,
      name,
      slug,
      api_key_hash: hashApiKey(apiKey),
      webhook_url: webhookUrl || null,
      timezone,
    })
    .select()
    .single()

  if (error) {
    // profiles_slug_key is a real UNIQUE constraint (contype='u'), so a
    // concurrent create loses here rather than silently producing a duplicate.
    // 23505 = unique_violation.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  // apiKey is returned exactly once — only its hash is stored, so it cannot be
  // recovered later. The caller must persist it (BUILD.md:855-863).
  return NextResponse.json({ profile, apiKey }, { status: 201 })
}
