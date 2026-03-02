import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { postId } = await params

  // Verify post belongs to this profile
  const { data: post } = await supabase
    .from('posts')
    .select('id, profile_id, content, platforms, status, created_at')
    .eq('id', postId)
    .eq('profile_id', auth.profile.id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data: results } = await supabase
    .from('post_results')
    .select(`
      platform, status, platform_post_id, platform_post_url, posted_at, attempts,
      analytics_snapshots(impressions, likes, comments, shares, clicks, reach, collected_at)
    `)
    .eq('post_id', postId)

  const totals = { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0 }
  const platformBreakdown = (results ?? []).map((r) => {
    const snap = Array.isArray(r.analytics_snapshots) ? r.analytics_snapshots[0] : null
    if (snap) {
      totals.impressions += snap.impressions ?? 0
      totals.likes += snap.likes ?? 0
      totals.comments += snap.comments ?? 0
      totals.shares += snap.shares ?? 0
      totals.clicks += snap.clicks ?? 0
    }
    return {
      platform: r.platform,
      status: r.status,
      postUrl: r.platform_post_url,
      postedAt: r.posted_at,
      analytics: snap,
    }
  })

  return NextResponse.json({
    postId,
    post: { content: post.content, platforms: post.platforms, status: post.status },
    totals,
    platforms: platformBreakdown,
  })
}
