import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'
import { SUPPORTED_PLATFORMS } from '@/lib/types'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user
  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId is required' }, { status: 400 })

  // Verify profile belongs to user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, slug')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch connected OAuth tokens
  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('platform, platform_username, expires_at')
    .eq('profile_id', profile.id)

  const connectedMap = new Map<string, { username: string | null; isValid: boolean }>()
  for (const t of tokens ?? []) {
    const isExpired = t.expires_at ? new Date(t.expires_at as string) < new Date() : false
    connectedMap.set(t.platform as string, {
      username: (t.platform_username as string | null) ?? null,
      isValid: !isExpired,
    })
  }

  const platforms = SUPPORTED_PLATFORMS.map((platform) => {
    const token = connectedMap.get(platform)
    return {
      platform,
      connected: connectedMap.has(platform),
      username: token?.username ?? null,
      isValid: token?.isValid ?? false,
    }
  })

  return NextResponse.json({
    profile: {
      id: profile.id as string,
      name: profile.name as string,
      slug: profile.slug as string,
    },
    platforms,
  })
}
