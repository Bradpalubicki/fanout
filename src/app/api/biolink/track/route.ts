import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  pageId: z.string().uuid(),
  linkIndex: z.number().int().min(0),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })
  const { pageId, linkIndex } = parsed.data

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
