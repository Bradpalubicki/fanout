import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'
import { getMobileUser } from '@/lib/mobile-auth'

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

  const { id } = await params

  // Verify post belongs to org
  const { data: post } = await supabase
    .from('posts')
    .select('id, profile_id, platforms, created_by, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  const postOrgId = (post.profiles as unknown as { org_id: string }).org_id
  if (postOrgId !== orgId) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Update status to pending (triggers fan-out)
  await supabase
    .from('posts')
    .update({ status: 'pending', reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  // Fire Inngest to publish
  await inngest.send({
    name: 'social/post.created',
    data: {
      postId: id,
      profileId: post.profile_id,
      platforms: post.platforms,
    },
  })

  // Push to author
  const authorId = post.created_by as string | null
  if (authorId && authorId !== userId) {
    await sendPushToUser(authorId, 'Post Approved', 'Your post was approved and queued for publishing.')
  }

  return NextResponse.json({ success: true })
}
