import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

const RejectSchema = z.object({
  note: z.string().min(1).max(500),
})

async function sendPushToUser(targetUserId: string, title: string, body: string) {
  const { data: tokens } = await supabase
    .from('mobile_push_tokens')
    .select('token')
    .eq('user_id', targetUserId)

  if (!tokens?.length) return

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      tokens.map((t: { token: string }) => ({
        to: t.token,
        title,
        body,
        sound: 'default',
      }))
    ),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, orgId } = user
  if (!orgId) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  // Verify admin
  const clerk = await clerkClient()
  const memberships = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
  const membership = memberships.data.find((m) => m.publicUserData?.userId === userId)
  if (membership?.role !== 'org:admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { note } = parsed.data
  const { id } = await params

  // Verify post belongs to org
  const { data: post } = await supabase
    .from('posts')
    .select('id, created_by, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  const postOrgId = (post.profiles as unknown as { org_id: string }).org_id
  if (postOrgId !== orgId) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Update: revert to draft with review note
  await supabase
    .from('posts')
    .update({
      status: 'draft',
      review_note: note,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Push to author
  const authorId = post.created_by as string | null
  if (authorId && authorId !== userId) {
    await sendPushToUser(authorId, 'Post Needs Revision', `Your post needs revision: ${note}`)
  }

  return NextResponse.json({ success: true })
}
