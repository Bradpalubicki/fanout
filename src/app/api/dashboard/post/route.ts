import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'

const PostSchema = z.object({
  post: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(9),
  profileId: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional(),
})

const ScheduleSchema = PostSchema.extend({
  scheduledFor: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Determine if scheduled
  const isScheduled = typeof (body as Record<string, unknown>).scheduledFor === 'string'
  const schema = isScheduled ? ScheduleSchema : PostSchema
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { post, platforms, profileId, mediaUrls } = parsed.data
  const scheduledFor = isScheduled ? (parsed.data as z.infer<typeof ScheduleSchema>).scheduledFor : null

  // Verify profile belongs to this org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, slug')
    .eq('org_id', orgId)
    .or(`id.eq.${profileId},slug.eq.${profileId}`)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (scheduledFor && new Date(scheduledFor) <= new Date()) {
    return NextResponse.json({ error: 'scheduledFor must be in the future' }, { status: 400 })
  }

  const { data: postRecord, error } = await supabase
    .from('posts')
    .insert({
      profile_id: profile.id,
      content: post,
      platforms,
      media_urls: mediaUrls ?? null,
      scheduled_for: scheduledFor,
      status: 'pending',
      source: 'dashboard',
    })
    .select()
    .single()

  if (error || !postRecord) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  if (scheduledFor) {
    await inngest.send({
      name: 'social/post.scheduled',
      data: { postId: postRecord.id, profileId: profile.id, platforms, scheduledFor },
    })
    return NextResponse.json({ status: 'scheduled', id: postRecord.id, scheduledFor })
  } else {
    await inngest.send({
      name: 'social/post.created',
      data: { postId: postRecord.id, profileId: profile.id, platforms },
    })
    return NextResponse.json({ status: 'queued', id: postRecord.id })
  }
}
