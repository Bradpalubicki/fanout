import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { inngest } from '@/lib/inngest'

const PostSchema = z.object({
  post: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(9),
  mediaUrls: z.array(z.string().url()).optional(),
  profileId: z.string().min(1),
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

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { post, platforms, mediaUrls, profileId } = parsed.data

  // Verify profileId belongs to this API key's org
  if (auth.profile.slug !== profileId && auth.profile.id !== profileId) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Create post record
  const { data: postRecord, error } = await supabase
    .from('posts')
    .insert({
      profile_id: auth.profile.id,
      content: post,
      platforms,
      media_urls: mediaUrls ?? null,
      status: 'pending',
      source: 'api',
    })
    .select()
    .single()

  if (error || !postRecord) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  // Trigger Inngest fan-out
  await inngest.send({
    name: 'social/post.created',
    data: {
      postId: postRecord.id,
      profileId: auth.profile.id,
      platforms,
    },
  })

  return NextResponse.json({
    status: 'queued',
    id: postRecord.id,
    message: 'Post queued for distribution',
  })
}
