import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const platform = req.nextUrl.searchParams.get('platform') ?? 'all'
  const status = req.nextUrl.searchParams.get('status') ?? 'all'

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ items: [], unreadCount: 0 })

  let query = supabase
    .from('inbox_items')
    .select('*')
    .in('profile_id', profileIds)
    .order('received_at', { ascending: false })
    .limit(100)

  if (platform !== 'all') query = query.eq('platform', platform)
  if (status === 'unread') query = query.eq('status', 'unread')

  const { data: items } = await query

  const { count: unreadCount } = await supabase
    .from('inbox_items')
    .select('*', { count: 'exact', head: true })
    .in('profile_id', profileIds)
    .eq('status', 'unread')

  return NextResponse.json({ items: items ?? [], unreadCount: unreadCount ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const schema = z.object({
    id: z.string(),
    status: z.enum(['read', 'replied']).optional(),
    reply: z.string().optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { id, status, reply } = parsed.data

  // Verify ownership
  const { data: item } = await supabase
    .from('inbox_items')
    .select('id, profile_id, platform, post_url, platform_item_id, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const itemOrgId = (item.profiles as unknown as { org_id: string }).org_id
  if (itemOrgId !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: Record<string, string> = {}
  if (status) updateData.status = status
  if (reply) {
    updateData.status = 'replied'
    // Note: actual platform API reply would go here based on platform
    // For now we just mark as replied
  }

  await supabase.from('inbox_items').update(updateData).eq('id', id)

  return NextResponse.json({ success: true })
}
