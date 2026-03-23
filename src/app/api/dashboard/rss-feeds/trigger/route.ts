export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const feedId = req.nextUrl.searchParams.get('feedId')
  if (!feedId) return NextResponse.json({ error: 'Missing feedId' }, { status: 400 })

  // Verify ownership via profile join
  const { data: feed } = await supabase
    .from('rss_feeds')
    .select('id, profiles!inner(org_id)')
    .eq('id', feedId)
    .single()

  if (!feed || (feed.profiles as unknown as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await inngest.send({ name: 'rss/check-feed', data: { feedId } })
  return NextResponse.json({ ok: true })
}
