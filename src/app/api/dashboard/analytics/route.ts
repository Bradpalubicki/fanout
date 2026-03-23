export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS } from '@/lib/types'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get all profiles for this org
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map((p) => p.id)

  if (!profileIds.length) {
    return NextResponse.json({
      totalPosts: 0,
      successRate: 0,
      activePlatforms: 0,
      totalProfiles: 0,
      platformBreakdown: [],
      topPosts: [],
      timeHeatmap: [],
      recentPosts: [],
    })
  }

  // Get posts in range
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, status, created_at, profile_id')
    .in('profile_id', profileIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  const postIds = (posts ?? []).map((p) => p.id)

  // Get post results
  const { data: results } = postIds.length
    ? await supabase
        .from('post_results')
        .select('post_id, platform, status, posted_at')
        .in('post_id', postIds)
    : { data: [] }

  const allPosts = posts ?? []
  const allResults = results ?? []

  const totalPosts = allPosts.length
  const successCount = allResults.filter((r) => r.status === 'success').length
  const successRate = allResults.length > 0 ? Math.round((successCount / allResults.length) * 100) : 0
  const activePlatforms = [...new Set(allResults.map((r) => r.platform))].length

  // Platform breakdown
  const platformBreakdown = SUPPORTED_PLATFORMS.map((p) => ({
    platform: p,
    label: PLATFORM_LABELS[p].split(' ')[0],
    success: allResults.filter((r) => r.platform === p && r.status === 'success').length,
    failed: allResults.filter((r) => r.platform === p && r.status === 'failed').length,
  })).filter((p) => p.success > 0 || p.failed > 0)

  // Top posts by success count
  const topPosts = allPosts
    .map((post) => {
      const postResults = allResults.filter((r) => r.post_id === post.id)
      return {
        id: post.id,
        content: post.content as string,
        platforms: post.platforms as string[],
        createdAt: post.created_at as string,
        results: postResults.map((r) => ({ platform: r.platform, status: r.status })),
        successCount: postResults.filter((r) => r.status === 'success').length,
      }
    })
    .sort((a, b) => b.successCount - a.successCount)
    .slice(0, 5)

  // Time heatmap — when do posts perform best
  const heatmap: Record<string, number> = {}
  for (const result of allResults) {
    if (result.status !== 'success' || !result.posted_at) continue
    const d = new Date(result.posted_at as string)
    const day = DAYS_OF_WEEK[d.getDay()]
    const hour = d.getHours()
    const key = `${day}:${hour}`
    heatmap[key] = (heatmap[key] ?? 0) + 1
  }
  const timeHeatmap = DAYS_OF_WEEK.flatMap((day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      day,
      hour,
      count: heatmap[`${day}:${hour}`] ?? 0,
    }))
  )

  // Recent posts with profile name
  const profileMap: Record<string, string> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p.name

  const recentPosts = allPosts.slice(0, 30).map((post) => {
    const postResults = allResults.filter((r) => r.post_id === post.id)
    return {
      id: post.id,
      content: post.content as string,
      platforms: post.platforms as string[],
      createdAt: post.created_at as string,
      profileName: profileMap[post.profile_id as string] ?? 'Unknown',
      successCount: postResults.filter((r) => r.status === 'success').length,
      failedCount: postResults.filter((r) => r.status === 'failed').length,
    }
  })

  return NextResponse.json({
    totalPosts,
    successRate,
    activePlatforms,
    totalProfiles: (profiles ?? []).length,
    platformBreakdown,
    topPosts,
    timeHeatmap,
    recentPosts,
  })
}
