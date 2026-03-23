export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

export async function GET(_req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profiles } = await supabase.from('profiles').select('id').eq('org_id', orgId)
  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ feeds: [] })

  const { data: feeds } = await supabase
    .from('rss_feeds')
    .select('*, profiles(name)')
    .in('profile_id', profileIds)
    .order('created_at', { ascending: false })

  return NextResponse.json({ feeds: feeds ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const schema = z.object({
    profileId: z.string(),
    url: z.string().url(),
    autoPost: z.boolean().default(false),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('id', parsed.data.profileId).eq('org_id', orgId).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('rss_feeds')
    .insert({ profile_id: parsed.data.profileId, url: parsed.data.url, auto_post: parsed.data.autoPost })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to add feed' }, { status: 500 })
  return NextResponse.json({ feed: data })
}

export async function DELETE(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: feed } = await supabase
    .from('rss_feeds')
    .select('profile_id, profiles!inner(org_id)')
    .eq('id', id).single()

  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((feed.profiles as unknown as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase.from('rss_feeds').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
