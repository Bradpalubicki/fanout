export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'
import { SUPPORTED_PLATFORMS } from '@/lib/types'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user
  const profileId = req.nextUrl.searchParams.get('profileId')
  const daysParam = req.nextUrl.searchParams.get('days')
  const days = daysParam ? parseInt(daysParam, 10) : 30

  if (!profileId) return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  if (isNaN(days) || days < 1) return NextResponse.json({ error: 'days must be a positive integer' }, { status: 400 })

  // Verify profile belongs to user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Posts in range
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, status, created_at')
    .eq('profile_id', profile.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  const allPosts = posts ?? []
  const postIds = allPosts.map((p) => p.id)

  // Post results
  const { data: results } = postIds.length
    ? await supabase
        .from('post_results')
        .select('id, post_id, platform, status')
        .in('post_id', postIds)
    : { data: [] }

  const allResults = results ?? []
  const resultIds = allResults.map((r) => r.id)

  // Analytics snapshots if available
  const { data: snapshots } = resultIds.length
    ? await supabase
        .from('analytics_snapshots')
        .select('post_result_id, platform, impressions, likes')
        .in('post_result_id', resultIds)
    : { data: [] }

  const allSnapshots = snapshots ?? []

  // Summary
  const totalPosts = allPosts.length
  const totalImpressions = allSnapshots.reduce((sum, s) => sum + (s.impressions ?? 0), 0)
  const totalLikes = allSnapshots.reduce((sum, s) => sum + (s.likes ?? 0), 0)
  const avgEngagementRate = totalImpressions > 0
    ? Math.round((totalLikes / totalImpressions) * 10000) / 100
    : 0

  // Per-platform breakdown
  const platforms = SUPPORTED_PLATFORMS
    .map((platform) => {
      const platformResults = allResults.filter((r) => r.platform === platform && r.status === 'success')
      const platformSnaps = allSnapshots.filter((s) => s.platform === platform)
      const impressions = platformSnaps.reduce((sum, s) => sum + (s.impressions ?? 0), 0)
      const likes = platformSnaps.reduce((sum, s) => sum + (s.likes ?? 0), 0)
      return {
        platform,
        posts: platformResults.length,
        impressions,
        likes,
        engagementRate: impressions > 0 ? Math.round((likes / impressions) * 10000) / 100 : 0,
      }
    })
    .filter((p) => p.posts > 0)

  // Top posts by impressions (fall back to recency if no snapshot data)
  const topPosts = allPosts
    .map((post) => {
      const postResultIds = allResults.filter((r) => r.post_id === post.id).map((r) => r.id)
      const postSnaps = allSnapshots.filter((s) => postResultIds.includes(s.post_result_id))
      const topPlatform = (post.platforms as string[])[0] ?? 'unknown'
      const impressions = postSnaps.reduce((sum, s) => sum + (s.impressions ?? 0), 0)
      const likes = postSnaps.reduce((sum, s) => sum + (s.likes ?? 0), 0)
      return { id: post.id as string, content: post.content as string, platform: topPlatform, impressions, likes }
    })
    .sort((a, b) => b.impressions - a.impressions || 0)
    .slice(0, 5)

  return NextResponse.json({
    summary: { totalPosts, totalImpressions, avgEngagementRate },
    platforms,
    topPosts,
  })
}
