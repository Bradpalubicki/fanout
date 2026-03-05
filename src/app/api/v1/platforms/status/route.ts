import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('platform')
    .eq('profile_id', auth.profile.id)

  const connectedPlatforms = new Set((tokens ?? []).map((t) => t.platform))

  const result = Object.entries(OAUTH_CONFIGS).map(([platform, config]) => {
    const clientId = process.env[config.clientIdEnv]
    const configured = Boolean(clientId && clientId !== 'placeholder' && clientId.length > 0)
    const connected = connectedPlatforms.has(platform)
    return { platform, configured, connected }
  })

  return NextResponse.json({ platforms: result })
}
