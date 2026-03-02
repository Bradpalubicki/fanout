import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { inngest } from '@/lib/inngest'

const ScheduleSchema = z.object({
  post: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(9),
  mediaUrls: z.array(z.string().url()).optional(),
  profileId: z.string().min(1),
  scheduledFor: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { post, platforms, mediaUrls, profileId, scheduledFor } = parsed.data

  if (auth.profile.slug !== profileId && auth.profile.id !== profileId) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const scheduledDate = new Date(scheduledFor)
  if (scheduledDate <= new Date()) {
    return NextResponse.json({ error: 'scheduledFor must be in the future' }, { status: 400 })
  }

  const { data: postRecord, error } = await supabase
    .from('posts')
    .insert({
      profile_id: auth.profile.id,
      content: post,
      platforms,
      media_urls: mediaUrls ?? null,
      scheduled_for: scheduledFor,
      status: 'pending',
      source: 'api',
    })
    .select()
    .single()

  if (error || !postRecord) {
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 })
  }

  // Schedule via Inngest
  await inngest.send({
    name: 'social/post.scheduled',
    data: {
      postId: postRecord.id,
      profileId: auth.profile.id,
      platforms,
      scheduledFor,
    },
  })

  return NextResponse.json({
    status: 'scheduled',
    id: postRecord.id,
    scheduledFor,
  })
}
