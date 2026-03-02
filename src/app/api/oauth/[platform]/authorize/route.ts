import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { generateStateToken } from '@/lib/crypto'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'
import { z } from 'zod'

const QuerySchema = z.object({
  profileId: z.string().uuid(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { platform } = await params
  const config = OAUTH_CONFIGS[platform]
  if (!config) {
    return NextResponse.json({ error: `Platform ${platform} not supported` }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({ profileId: searchParams.get('profileId') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 })
  }

  const stateToken = generateStateToken()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await supabase.from('oauth_state').insert({
    token: stateToken,
    profile_id: parsed.data.profileId,
    platform,
    expires_at: expiresAt.toISOString(),
  })

  const clientId = process.env[config.clientIdEnv]
  const callbackUrl = process.env[config.callbackEnv]

  if (!clientId || !callbackUrl) {
    return NextResponse.json(
      { error: `Platform ${platform} OAuth not configured` },
      { status: 503 }
    )
  }

  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', callbackUrl)
  authUrl.searchParams.set('scope', config.scopes.join(' '))
  authUrl.searchParams.set('state', stateToken)
  authUrl.searchParams.set('response_type', 'code')

  if (platform === 'twitter') {
    authUrl.searchParams.set('code_challenge', 'challenge')
    authUrl.searchParams.set('code_challenge_method', 'plain')
  }
  if (platform === 'reddit') {
    authUrl.searchParams.set('duration', 'permanent')
  }
  if (platform === 'youtube') {
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
  }

  return NextResponse.redirect(authUrl.toString())
}
