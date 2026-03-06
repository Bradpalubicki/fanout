import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'
import { z } from 'zod'

export async function GET(_req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profiles } = await supabase.from('profiles').select('id').eq('org_id', orgId)
  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ posts: [] })

  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, scheduled_for, created_at, source, profiles(name)')
    .in('profile_id', profileIds)
    .eq('status', 'pending_approval')
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json({ posts: posts ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const schema = z.object({
    id: z.string(),
    action: z.enum(['approve', 'reject']),
    content: z.string().optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { id, action, content } = parsed.data

  // Verify ownership
  const { data: post } = await supabase
    .from('posts')
    .select('id, profile_id, platforms, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!post || (post.profiles as unknown as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (action === 'reject') {
    await supabase.from('posts').update({ status: 'draft' }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  // Approve: update content if edited, set status to pending, fire fan-out
  const updates: Record<string, unknown> = { status: 'pending' }
  if (content) updates.content = content

  await supabase.from('posts').update(updates).eq('id', id)

  await inngest.send({
    name: 'social/post.created',
    data: {
      postId: id,
      profileId: post.profile_id,
      platforms: post.platforms,
    },
  })

  return NextResponse.json({ success: true })
}

// Approve all
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if ((body as { action?: string }).action !== 'approve_all') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: profiles } = await supabase.from('profiles').select('id').eq('org_id', orgId)
  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ approved: 0 })

  const { data: posts } = await supabase
    .from('posts')
    .select('id, profile_id, platforms')
    .in('profile_id', profileIds)
    .eq('status', 'pending_approval')
    .limit(100)

  if (!posts?.length) return NextResponse.json({ approved: 0 })

  // Bulk status update
  await supabase
    .from('posts')
    .update({ status: 'pending' })
    .in('id', posts.map((p) => p.id))

  // Fire Inngest for each
  await Promise.all(
    posts.map((post) =>
      inngest.send({
        name: 'social/post.created',
        data: { postId: post.id, profileId: post.profile_id, platforms: post.platforms },
      })
    )
  )

  return NextResponse.json({ approved: posts.length })
}
