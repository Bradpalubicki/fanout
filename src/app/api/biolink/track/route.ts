import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { pageId, linkIndex } = await req.json() as { pageId: string; linkIndex: number }
  if (!pageId) return NextResponse.json({ ok: false })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  // Hash IP for privacy
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + 'fanout-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const ipHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  await supabase.from('biolink_clicks').insert({
    page_id: pageId,
    link_index: linkIndex,
    user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    ip_hash: ipHash,
    clicked_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
