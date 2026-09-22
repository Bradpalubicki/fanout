export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'
import { enqueuePostEvent } from '@/lib/enqueue'

const PostSchema = z.object({
  profileId: z.string().min(1),
  content: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(12),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledFor: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { profileId, content, platforms, mediaUrls, scheduledFor } = parsed.data

  // Verify profile belongs to user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, slug')
    .eq('org_id', orgId)
    .or(`id.eq.${profileId},slug.eq.${profileId}`)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (scheduledFor && new Date(scheduledFor) <= new Date()) {
    return NextResponse.json({ error: 'scheduledFor must be in the future' }, { status: 400 })
  }

  const { data: postRecord, error } = await supabase
    .from('posts')
    .insert({
      profile_id: profile.id,
      content,
      platforms,
      media_urls: mediaUrls ?? null,
      scheduled_for: scheduledFor ?? null,
      status: scheduledFor ? 'scheduled' : 'pending',
      source: 'api',
    })
    .select()
    .single()

  if (error || !postRecord) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  const queueFailed = NextResponse.json(
    { error: 'Queue unavailable', id: postRecord.id as string },
    { status: 503 }
  )

  if (scheduledFor) {
    const queued = await enqueuePostEvent(
      {
        name: 'social/post.scheduled',
        data: { postId: postRecord.id, profileId: profile.id, platforms, scheduledFor },
      },
      { postId: postRecord.id as string, platforms }
    )
    if (!queued) return queueFailed
    return NextResponse.json({ id: postRecord.id as string, status: 'scheduled' })
  } else {
    const queued = await enqueuePostEvent(
      {
        name: 'social/post.created',
        data: { postId: postRecord.id, profileId: profile.id, platforms },
      },
      { postId: postRecord.id as string, platforms }
    )
    if (!queued) return queueFailed
    return NextResponse.json({ id: postRecord.id as string, status: 'queued' })
  }
}
