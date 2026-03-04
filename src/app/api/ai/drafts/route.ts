import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get profile IDs for this org
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ drafts: [] })

  const { data: drafts } = await supabase
    .from('ai_drafts')
    .select('id, prompt, generated, platforms, status, created_at')
    .in('profile_id', profileIds)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ drafts: drafts ?? [] })
}
