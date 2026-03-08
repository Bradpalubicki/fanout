import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user
  const { id } = await params

  // Fetch post and verify org ownership via profile
  const { data: post } = await supabase
    .from('posts')
    .select('id, content, platforms, status, scheduled_for, created_at, profile_id')
    .eq('id', id)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Verify ownership
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', post.profile_id)
    .eq('org_id', orgId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Fetch results
  const { data: results } = await supabase
    .from('post_results')
    .select('id, platform, status, platform_post_url, error_message')
    .eq('post_id', id)

  const allResults = results ?? []
  const resultIds = allResults.map((r) => r.id)

  // Fetch analytics snapshots
  const { data: snapshots } = resultIds.length
    ? await supabase
        .from('analytics_snapshots')
        .select('post_result_id, impressions, likes')
        .in('post_result_id', resultIds)
    : { data: [] }

  const allSnapshots = snapshots ?? []

  const postResults = allResults.map((r) => {
    const snap = allSnapshots.find((s) => s.post_result_id === r.id)
    return {
      platform: r.platform as string,
      status: r.status as string,
      platformPostUrl: (r.platform_post_url as string | null) ?? null,
      errorMessage: (r.error_message as string | null) ?? null,
      impressions: snap?.impressions ?? 0,
      likes: snap?.likes ?? 0,
    }
  })

  return NextResponse.json({
    id: post.id as string,
    content: post.content as string,
    platforms: post.platforms as string[],
    status: post.status as string,
    scheduledFor: (post.scheduled_for as string | null) ?? null,
    createdAt: post.created_at as string,
    results: postResults,
  })
}
