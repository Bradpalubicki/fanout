export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'

/**
 * Diagnose why a connected Meta platform lists no Pages.
 *
 * "No accounts found" on the page picker is ambiguous: /me/accounts returns
 * HTTP 200 with an empty array both when the user administers no Pages AND
 * when the token lacks pages_show_list. Those need opposite fixes — create a
 * Page, versus re-grant permissions — and guessing between them wastes a
 * reconnect cycle each time.
 *
 * This asks Meta directly via debug_token, which reports the scopes ACTUALLY
 * granted rather than the ones we requested. The callback does not persist
 * granted scopes (oauth_tokens.scopes is NULL for every Meta row), so this is
 * currently the only way to know.
 *
 * Read-only. Returns no token material.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { platform } = await params
  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 })
  }

  // Bind the profile to the caller's org before reading its token.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, name')
    .eq('id', profileId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json(
      { error: 'No profile exists with that id.', profileId },
      { status: 404 }
    )
  }

  /**
   * A bare 404 here is indistinguishable from "this route is not deployed",
   * which sent a real debugging session down the wrong path on 2026-09-23.
   * The profile exists but belongs to another organization, so say exactly
   * that — the fix is an org switch, not a redeploy.
   */
  if (profile.org_id !== orgId) {
    return NextResponse.json(
      {
        error: 'That profile belongs to a different organization.',
        hint: 'Switch to the organization that owns it using the organization switcher, then retry.',
        profileName: profile.name,
        profileOrgId: profile.org_id,
        yourActiveOrgId: orgId,
      },
      { status: 403 }
    )
  }

  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token, platform_page_id, platform_user_id, expires_at')
    .eq('profile_id', profileId)
    .eq('platform', platform)
    .maybeSingle()

  if (!tokenRow) {
    return NextResponse.json({ error: 'No token stored for this platform' }, { status: 404 })
  }

  let userToken: string
  try {
    userToken = await decryptToken(tokenRow.access_token)
  } catch (err) {
    return NextResponse.json(
      { stage: 'decrypt', ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'Meta app credentials not configured' }, { status: 500 })
  }

  // 1. What did Meta actually grant?
  const debugRes = await fetch(
    `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${appId}|${appSecret}`
  )
  const debug = (await debugRes.json()) as {
    data?: {
      app_id?: string
      type?: string
      is_valid?: boolean
      scopes?: string[]
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>
      user_id?: string
      expires_at?: number
    }
    error?: { message?: string }
  }

  // 2. What does /me/accounts actually return, verbatim?
  const accountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,tasks&access_token=${encodeURIComponent(userToken)}`
  )
  const accounts = (await accountsRes.json()) as {
    data?: Array<{ id: string; name: string; tasks?: string[] }>
    error?: { message?: string; code?: number; type?: string }
  }

  const granted = debug.data?.scopes ?? []
  const pageCount = accounts.data?.length ?? 0

  // Name the likely cause rather than leaving the caller to guess between two
  // findings that need opposite fixes.
  let diagnosis: string
  if (!debug.data?.is_valid) {
    diagnosis = 'The stored token is not valid. Reconnect the platform.'
  } else if (!granted.includes('pages_show_list')) {
    diagnosis =
      'pages_show_list was NOT granted, so /me/accounts can never list Pages regardless of how many exist. Re-run the connect flow and accept the Pages permissions.'
  } else if (pageCount === 0) {
    diagnosis =
      'pages_show_list WAS granted and Meta returned zero Pages, so this Facebook user administers no Page the app can see. Create a Page, or grant the app access to an existing one during the connect flow.'
  } else {
    diagnosis = `${pageCount} Page(s) visible. If the picker is still empty, the fault is in the picker, not the grant.`
  }

  return NextResponse.json({
    platform,
    tokenValid: debug.data?.is_valid ?? false,
    tokenType: debug.data?.type ?? null,
    appIdOnToken: debug.data?.app_id ?? null,
    grantedScopes: granted,
    granularScopes: debug.data?.granular_scopes ?? [],
    requestedButNotGranted: ['pages_manage_posts', 'pages_show_list', 'pages_read_engagement'].filter(
      (s) => !granted.includes(s)
    ),
    meAccounts: {
      httpStatus: accountsRes.status,
      pageCount,
      pages: (accounts.data ?? []).map((p) => ({ id: p.id, name: p.name, tasks: p.tasks })),
      error: accounts.error ?? null,
    },
    storedPageId: tokenRow.platform_page_id,
    diagnosis,
  })
}
