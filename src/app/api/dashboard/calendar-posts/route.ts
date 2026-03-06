import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map(p => p.id)
  if (!profileIds.length) return NextResponse.json({ posts: [] })

  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, scheduled_for, status, profile_id')
    .in('profile_id', profileIds)
    .not('scheduled_for', 'is', null)
    .in('status', ['pending', 'pending_approval', 'draft'])
    .order('scheduled_for', { ascending: true })
    .limit(500)

  return NextResponse.json({ posts: posts ?? [] })
}
