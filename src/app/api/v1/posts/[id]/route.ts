export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rl = await checkRateLimit(auth.profile.id)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. 100 requests per minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const { id } = await params

  // Verify post belongs to this profile
  const { data: post } = await supabase
    .from('posts')
    .select('id, profile_id, content, platforms, media_urls, status, scheduled_for, metadata, platform_config, source, created_at')
    .eq('id', id)
    .eq('profile_id', auth.profile.id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Get per-platform results
  const { data: results } = await supabase
    .from('post_results')
    .select('platform, status, platform_post_id, platform_post_url, error_message, posted_at, attempts')
    .eq('post_id', id)

  return NextResponse.json({
    id: post.id,
    status: post.status,
    content: post.content,
    platforms: post.platforms,
    media_urls: post.media_urls,
    scheduled_for: post.scheduled_for,
    metadata: post.metadata,
    platform_config: post.platform_config,
    created_at: post.created_at,
    results: (results ?? []).map((r) => ({
      platform: r.platform,
      status: r.status,
      post_url: r.platform_post_url,
      post_id: r.platform_post_id,
      error: r.error_message,
      posted_at: r.posted_at,
      attempts: r.attempts,
    })),
  })
}
