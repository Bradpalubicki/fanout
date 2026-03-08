import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'
import { SUPPORTED_PLATFORMS } from '@/lib/types'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user
  if (!orgId) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  // Get all profiles for org
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, slug')
    .eq('org_id', orgId)
    .order('name', { ascending: true })

  if (!profiles?.length) return NextResponse.json({ profiles: [] })

  const profileIds = profiles.map((p) => p.id as string)

  // Month start for post count
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Post counts this month (one query for all profiles)
  const { data: monthPosts } = await supabase
    .from('posts')
    .select('profile_id')
    .in('profile_id', profileIds)
    .gte('created_at', monthStart)
    .eq('status', 'posted')

  const postCountMap: Record<string, number> = {}
  for (const p of monthPosts ?? []) {
    const pid = p.profile_id as string
    postCountMap[pid] = (postCountMap[pid] ?? 0) + 1
  }

  // OAuth tokens for platform connection status
  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('profile_id, platform, platform_username')
    .in('profile_id', profileIds)

  const tokenMap: Record<string, Record<string, string | null>> = {}
  for (const t of tokens ?? []) {
    const pid = t.profile_id as string
    if (!tokenMap[pid]) tokenMap[pid] = {}
    tokenMap[pid][t.platform as string] = (t.platform_username as string | null) ?? null
  }

  const result = profiles.map((profile) => {
    const pid = profile.id as string
    const profileTokens = tokenMap[pid] ?? {}

    return {
      id: pid,
      name: profile.name as string,
      slug: profile.slug as string,
      postsThisMonth: postCountMap[pid] ?? 0,
      platforms: SUPPORTED_PLATFORMS.map((platform) => ({
        platform,
        connected: platform in profileTokens,
        username: profileTokens[platform] ?? null,
      })),
    }
  })

  return NextResponse.json({ profiles: result })
}
