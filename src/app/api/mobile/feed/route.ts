import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: _userId, orgId } = user
  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId is required' }, { status: 400 })

  // Verify profile belongs to user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  // Fetch recent posts
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, status, scheduled_for, created_at')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const allPosts = posts ?? []
  const postIds = allPosts.map((p) => p.id)

  // Fetch post results
  const { data: results } = postIds.length
    ? await supabase
        .from('post_results')
        .select('post_id, platform, status')
        .in('post_id', postIds)
    : { data: [] }

  const allResults = results ?? []

  // Stats
  const postedToday = allPosts.filter(
    (p) => p.status === 'posted' && new Date(p.created_at as string) >= todayStart
  ).length

  // For scheduled/failed counts, fetch all (not just top 20)
  const { count: scheduledCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('status', 'scheduled')
    .gt('scheduled_for', now.toISOString())

  const { count: failedCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('status', 'failed')

  // Upcoming scheduled (next 3)
  const { data: upcoming } = await supabase
    .from('posts')
    .select('id, content, platforms, scheduled_for')
    .eq('profile_id', profile.id)
    .eq('status', 'scheduled')
    .gt('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(3)

  const recentPosts = allPosts.map((post) => {
    const postResults = allResults.filter((r) => r.post_id === post.id)
    return {
      id: post.id as string,
      content: post.content as string,
      platforms: post.platforms as string[],
      status: post.status as 'posted' | 'scheduled' | 'failed' | 'draft',
      scheduledFor: (post.scheduled_for as string | null) ?? null,
      createdAt: post.created_at as string,
      platformResults: postResults.map((r) => ({ platform: r.platform as string, status: r.status as string })),
    }
  })

  const upcomingScheduled = (upcoming ?? []).map((p) => ({
    id: p.id as string,
    content: p.content as string,
    platforms: p.platforms as string[],
    scheduledFor: p.scheduled_for as string,
  }))

  return NextResponse.json({
    stats: {
      postedToday,
      scheduled: scheduledCount ?? 0,
      failed: failedCount ?? 0,
    },
    recentPosts,
    upcomingScheduled,
  })
}
