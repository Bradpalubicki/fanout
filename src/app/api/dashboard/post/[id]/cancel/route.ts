export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify post belongs to this org
  const { data: post } = await supabase
    .from('posts')
    .select('id, profile_id, status, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const profileOrgId = (post.profiles as unknown as { org_id: string }).org_id
  if (profileOrgId !== orgId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot cancel a post with status "${post.status}"` },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('posts')
    .update({ status: 'draft', scheduled_for: null })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to cancel post' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
