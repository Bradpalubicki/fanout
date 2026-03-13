/**
 * /api/engine/submit
 * Called by NuStack client engines (Little Roots, AK Dental, etc.)
 * to submit social posts through Fanout without managing Fanout profile UUIDs.
 *
 * Auth: FANOUT_ENGINE_KEY shared secret (set in each engine's env vars)
 * The engine_slug maps to a profile in the profiles table.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'

const SubmitSchema = z.object({
  engine_slug: z.string().min(1),    // e.g. "littleroots", "ak-dental"
  content: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1).max(9).default(['facebook', 'instagram']),
  media_urls: z.array(z.string().url()).optional(),
  scheduled_for: z.string().datetime().optional(), // ISO8601 — omit to post immediately
  source_type: z.enum(['gallery', 'campaign', 'special', 'announcement', 'manual']).default('manual'),
  source_id: z.string().optional(),  // ID of the originating record (gallery_item.id, etc.)
})

export async function POST(req: NextRequest) {
  // Verify engine key
  const authHeader = req.headers.get('authorization')
  const engineKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!engineKey || engineKey !== process.env.FANOUT_ENGINE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { engine_slug, content, platforms, media_urls, scheduled_for, source_type, source_id } = parsed.data

  // Look up profile by slug
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, org_id')
    .eq('slug', engine_slug)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: `No Fanout profile found for engine "${engine_slug}". Create one at fanout.digital/dashboard/profiles.` },
      { status: 404 }
    )
  }

  // Create post record
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      profile_id: profile.id,
      content,
      platforms,
      media_urls: media_urls ?? null,
      scheduled_for: scheduled_for ?? null,
      status: 'pending',
      source: 'api',
    })
    .select('id')
    .single()

  if (postError || !post) {
    console.error('Fanout engine submit error:', postError)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  if (scheduled_for) {
    // Schedule via Inngest
    await inngest.send({
      name: 'social/post.scheduled',
      data: { postId: post.id, profileId: profile.id, platforms, scheduledFor: scheduled_for },
    })
    return NextResponse.json({ status: 'scheduled', id: post.id, scheduled_for, source_type, source_id })
  } else {
    // Post immediately
    await inngest.send({
      name: 'social/post.created',
      data: { postId: post.id, profileId: profile.id, platforms },
    })
    return NextResponse.json({ status: 'queued', id: post.id, source_type, source_id })
  }
}
