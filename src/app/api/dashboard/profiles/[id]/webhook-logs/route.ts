export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

const retrySchema = z.object({ logId: z.string().uuid() })

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('profile_id', id)
    .order('delivered_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ logs: logs ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const parsed = retrySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'logId (UUID) required' }, { status: 400 })
  }
  const { logId } = parsed.data

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, webhook_url')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.webhook_url) {
    return NextResponse.json({ error: 'No webhook URL configured' }, { status: 400 })
  }

  const { data: log } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('id', logId)
    .eq('profile_id', id)
    .single()

  if (!log) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 })
  }

  let responseStatus: number | null = null
  let responseBody: string | null = null

  try {
    const res = await fetch(profile.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: log.event_type, ...log.payload, _retry: true }),
    })
    responseStatus = res.status
    responseBody = await res.text().catch(() => null)
  } catch (err) {
    responseStatus = 0
    responseBody = err instanceof Error ? err.message : 'Network error'
  }

  await supabase.from('webhook_logs').insert({
    profile_id: id,
    event_type: log.event_type,
    payload: log.payload,
    response_status: responseStatus,
    response_body: responseBody,
    attempts: (log.attempts as number) + 1,
  })

  return NextResponse.json({ success: true, responseStatus })
}
