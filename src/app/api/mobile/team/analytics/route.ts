export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user
  if (!orgId) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10), 365)
  const profileId = req.nextUrl.searchParams.get('profileId') ?? 'all'
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get org profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('org_id', orgId)

  if (!profiles?.length) {
    return NextResponse.json({
      summary: { totalPosts: 0, totalImpressions: 0, totalEngagement: 0 },
      byProfile: [],
      topPost: null,
    })
  }

  const allProfileIds = profiles.map((p) => p.id as string)
  const profileNameMap: Record<string, string> = {}
  for (const p of profiles) profileNameMap[p.id as string] = p.name as string

  // Filter to specific profile if requested
  let targetProfileIds = allProfileIds
  if (profileId !== 'all') {
    if (!allProfileIds.includes(profileId)) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    targetProfileIds = [profileId]
  }

  // Get posts in date range
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, profile_id')
    .in('profile_id', targetProfileIds)
    .gte('created_at', since)
    .eq('status', 'posted')

  if (!posts?.length) {
    return NextResponse.json({
      summary: { totalPosts: 0, totalImpressions: 0, totalEngagement: 0 },
      byProfile: targetProfileIds.map((pid) => ({
        profileId: pid,
        profileName: profileNameMap[pid] ?? 'Unknown',
        posts: 0,
        impressions: 0,
        topPlatform: '',
      })),
      topPost: null,
    })
  }

  const postIds = posts.map((p) => p.id as string)

  // Get post results
  const { data: results } = await supabase
    .from('post_results')
    .select('id, post_id, platform, status')
    .in('post_id', postIds)
    .eq('status', 'success')

  const resultIds = (results ?? []).map((r) => r.id).filter(Boolean)

  // Get analytics snapshots for impressions/engagement
  const { data: snapshots } = resultIds.length
    ? await supabase
        .from('analytics_snapshots')
        .select('post_result_id, platform, impressions, likes, comments, shares, clicks')
        .in('post_result_id', resultIds)
    : { data: [] }

  // Build post result map: postId -> { platform -> resultId }
  const postResultIdMap: Record<string, Record<string, string>> = {}
  for (const r of results ?? []) {
    const pid = r.post_id as string
    if (!postResultIdMap[pid]) postResultIdMap[pid] = {}
    postResultIdMap[pid][r.platform as string] = r.id as string
  }

  // Build snapshot map: resultId -> { impressions, engagement }
  const snapshotMap: Record<string, { impressions: number; engagement: number }> = {}
  for (const s of snapshots ?? []) {
    const rid = s.post_result_id as string
    const impressions = (s.impressions as number | null) ?? 0
    const engagement =
      ((s.likes as number | null) ?? 0) +
      ((s.comments as number | null) ?? 0) +
      ((s.shares as number | null) ?? 0) +
      ((s.clicks as number | null) ?? 0)
    snapshotMap[rid] = { impressions, engagement }
  }

  // Aggregate by profile
  const profileStats: Record<string, { posts: number; impressions: number; platformCounts: Record<string, number> }> = {}
  for (const pid of targetProfileIds) {
    profileStats[pid] = { posts: 0, impressions: 0, platformCounts: {} }
  }

  let totalImpressions = 0
  let totalEngagement = 0

  // Post with highest impressions
  let topPostData: { id: string; content: string; platform: string; impressions: number } | null = null

  for (const post of posts) {
    const pid = post.profile_id as string
    if (!profileStats[pid]) continue
    profileStats[pid].posts++

    const platforms = post.platforms as string[]
    let postImpressions = 0
    let topPlatform = platforms[0] ?? ''
    let topPlatformImpressions = 0

    for (const platform of platforms) {
      const resultId = postResultIdMap[post.id as string]?.[platform]
      if (!resultId) continue
      const snap = snapshotMap[resultId]
      if (!snap) continue

      postImpressions += snap.impressions
      totalEngagement += snap.engagement

      profileStats[pid].impressions += snap.impressions
      profileStats[pid].platformCounts[platform] = (profileStats[pid].platformCounts[platform] ?? 0) + snap.impressions

      if (snap.impressions > topPlatformImpressions) {
        topPlatformImpressions = snap.impressions
        topPlatform = platform
      }
    }

    totalImpressions += postImpressions

    if (!topPostData || postImpressions > topPostData.impressions) {
      topPostData = {
        id: post.id as string,
        content: post.content as string,
        platform: topPlatform,
        impressions: postImpressions,
      }
    }
  }

  const byProfile = targetProfileIds.map((pid) => {
    const stats = profileStats[pid] ?? { posts: 0, impressions: 0, platformCounts: {} }
    const topPlatform = Object.entries(stats.platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    return {
      profileId: pid,
      profileName: profileNameMap[pid] ?? 'Unknown',
      posts: stats.posts,
      impressions: stats.impressions,
      topPlatform,
    }
  })

  return NextResponse.json({
    summary: {
      totalPosts: posts.length,
      totalImpressions,
      totalEngagement,
    },
    byProfile,
    topPost: topPostData,
  })
}
