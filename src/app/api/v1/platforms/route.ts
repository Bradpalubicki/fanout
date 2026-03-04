import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rl = await checkRateLimit(auth.profile.id)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. 100 requests per minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('platform, platform_username, platform_user_id, expires_at, scopes, created_at, updated_at')
    .eq('profile_id', auth.profile.id)

  const platforms = (tokens ?? []).map((t) => ({
    platform: t.platform,
    connected: true,
    username: t.platform_username,
    userId: t.platform_user_id,
    expiresAt: t.expires_at,
    scopes: t.scopes,
    connectedAt: t.created_at,
    lastRefreshed: t.updated_at,
    tokenExpired: t.expires_at ? new Date(t.expires_at) < new Date() : false,
  }))

  return NextResponse.json({ platforms })
}
