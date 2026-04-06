export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { inngest } from '@/lib/inngest'
import { checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateOrgSubscription, isSubscriptionActive, isTrialExpired } from '@/lib/subscriptions'

const PostsSchema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(13),
  profile: z.string().min(1),
  scheduled_for: z.string().datetime().optional(),
  media_urls: z.array(z.string().url()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  platform_config: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PostsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { content, platforms, profile, scheduled_for, media_urls, metadata, platform_config } = parsed.data

  // Check subscription
  const sub = await getOrCreateOrgSubscription(auth.profile.org_id)
  if (!isSubscriptionActive(sub) || isTrialExpired(sub)) {
    return NextResponse.json(
      { error: 'Subscription required. Visit fanout.digital/dashboard/billing to upgrade.' },
      { status: 402 }
    )
  }

  // Verify profile matches the API key's profile (by slug or UUID)
  if (auth.profile.slug !== profile && auth.profile.id !== profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Validate scheduled_for is in the future if provided
  if (scheduled_for) {
    const scheduledDate = new Date(scheduled_for)
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: 'scheduled_for must be in the future' }, { status: 400 })
    }
  }

  // Create post record
  const { data: postRecord, error } = await supabase
    .from('posts')
    .insert({
      profile_id: auth.profile.id,
      content,
      platforms,
      media_urls: media_urls ?? null,
      scheduled_for: scheduled_for ?? null,
      metadata: metadata ?? {},
      platform_config: platform_config ?? {},
      status: 'pending',
      source: 'api',
    })
    .select('id')
    .single()

  if (error || !postRecord) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  if (scheduled_for) {
    await inngest.send({
      name: 'social/post.scheduled',
      data: {
        postId: postRecord.id,
        profileId: auth.profile.id,
        platforms,
        scheduledFor: scheduled_for,
      },
    })

    return NextResponse.json({
      id: postRecord.id,
      status: 'scheduled',
      scheduled_for,
      platforms,
      profile: auth.profile.slug,
    })
  }

  await inngest.send({
    name: 'social/post.created',
    data: {
      postId: postRecord.id,
      profileId: auth.profile.id,
      platforms,
    },
  })

  return NextResponse.json({
    id: postRecord.id,
    status: 'queued',
    scheduled_for: null,
    platforms,
    profile: auth.profile.slug,
  })
}
