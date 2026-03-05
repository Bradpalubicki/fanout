import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { encryptToken, generateStateToken } from '@/lib/crypto'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params
  const { searchParams } = new URL(req.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/profiles?error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/profiles?error=missing_params', req.url)
    )
  }

  // Verify state token
  const { data: stateRecord, error: stateError } = await supabase
    .from('oauth_state')
    .select('*')
    .eq('token', state)
    .eq('platform', platform)
    .single()

  if (stateError || !stateRecord) {
    return NextResponse.redirect(
      new URL('/dashboard/profiles?error=invalid_state', req.url)
    )
  }

  if (new Date(stateRecord.expires_at) < new Date()) {
    await supabase.from('oauth_state').delete().eq('token', state)
    return NextResponse.redirect(
      new URL('/dashboard/profiles?error=state_expired', req.url)
    )
  }

  // Delete used state token
  await supabase.from('oauth_state').delete().eq('token', state)

  const config = OAUTH_CONFIGS[platform]
  const clientId = process.env[config.clientIdEnv]
  const clientSecret = process.env[config.clientSecretEnv]
  const callbackUrl = process.env[config.callbackEnv]

  if (!clientId || !clientSecret || !callbackUrl) {
    return NextResponse.redirect(
      new URL(`/dashboard/profiles?error=platform_not_configured`, req.url)
    )
  }

  // Exchange code for tokens
  let tokenRes: Response
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: clientId,
    client_secret: clientSecret,
  })

  if (platform === 'twitter') {
    // Use the PKCE verifier stored alongside the state token (generated at authorize time)
    const codeVerifier = (stateRecord as { code_verifier?: string }).code_verifier ?? ''
    if (codeVerifier) tokenBody.set('code_verifier', codeVerifier)
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${creds}`,
      },
      body: tokenBody.toString(),
    })
  } else {
    tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    })
  }

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL(`/dashboard/profiles?error=token_exchange_failed`, req.url)
    )
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
  }

  if (!tokenData.access_token) {
    return NextResponse.redirect(
      new URL(`/dashboard/profiles?error=no_access_token`, req.url)
    )
  }

  // Encrypt tokens
  const encryptedAccess = await encryptToken(tokenData.access_token)
  const encryptedRefresh = tokenData.refresh_token
    ? await encryptToken(tokenData.refresh_token)
    : null

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  // Get platform user info
  let platformUserId: string | null = null
  let platformUsername: string | null = null

  try {
    if (platform === 'twitter') {
      const me = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const meData = await me.json() as { data?: { id: string; username: string } }
      platformUserId = meData.data?.id ?? null
      platformUsername = meData.data?.username ?? null
    } else if (platform === 'linkedin') {
      const me = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const meData = await me.json() as { sub?: string; name?: string }
      platformUserId = meData.sub ?? null
      platformUsername = meData.name ?? null
    }
  } catch {
    // Non-fatal — user info enrichment
  }

  // For Meta platforms (Facebook, Instagram, Threads), store user token first
  // then redirect to page selector — page token is required for posting
  if (platform === 'facebook' || platform === 'instagram' || platform === 'threads') {
    // Store the user token temporarily (will be replaced by page token after selection)
    await supabase.from('oauth_tokens').upsert(
      {
        profile_id: stateRecord.profile_id,
        platform,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        platform_user_id: platformUserId,
        platform_username: platformUsername,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,platform' }
    )

    // Redirect to page selector — pass user token via encrypted state in DB
    const selectorState = generateStateToken()
    await supabase.from('oauth_state').insert({
      token: selectorState,
      profile_id: stateRecord.profile_id,
      platform,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    return NextResponse.redirect(
      new URL(
        `/dashboard/profiles/${stateRecord.profile_id}/select-page?platform=${platform}&state=${selectorState}`,
        req.url
      )
    )
  }

  // Upsert token
  await supabase.from('oauth_tokens').upsert(
    {
      profile_id: stateRecord.profile_id,
      platform,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      platform_user_id: platformUserId,
      platform_username: platformUsername,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,platform' }
  )

  // Audit log
  await supabase.from('oauth_audit_log').insert({
    profile_id: stateRecord.profile_id,
    platform,
    action: 'connect',
    success: true,
    metadata: { platform_user_id: platformUserId, platform_username: platformUsername },
  })

  return NextResponse.redirect(
    new URL(`/dashboard/profiles/${stateRecord.profile_id}?connected=${platform}`, req.url)
  )
}
