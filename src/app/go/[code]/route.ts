import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const { data: link } = await supabase
    .from('short_links')
    .select('id, target_url, clicks_total')
    .eq('code', code)
    .single()

  if (!link) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Track click
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + 'fanout-link-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const ipHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  await Promise.all([
    supabase.from('link_clicks').insert({
      link_id: link.id,
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
      ip_hash: ipHash,
      clicked_at: new Date().toISOString(),
    }),
    supabase.from('short_links').update({ clicks_total: (link.clicks_total ?? 0) + 1 }).eq('id', link.id),
  ])

  return NextResponse.redirect(link.target_url as string)
}
