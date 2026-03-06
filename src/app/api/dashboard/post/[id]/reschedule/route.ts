import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const schema = z.object({
  scheduled_for: z.string().datetime(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scheduled_for' }, { status: 400 })
  }

  // Verify post belongs to this org
  const { data: post } = await supabase
    .from('posts')
    .select('id, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const profileOrgId = (post.profiles as unknown as { org_id: string }).org_id
  if (profileOrgId !== orgId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('posts')
    .update({ scheduled_for: parsed.data.scheduled_for })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to reschedule post' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
