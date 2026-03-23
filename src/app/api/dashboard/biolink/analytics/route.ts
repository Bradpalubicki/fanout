export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get org's profiles → biolink pages
  const { data: profiles } = await supabase.from('profiles').select('id').eq('org_id', orgId)
  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json(null)

  const { data: pages } = await supabase
    .from('biolink_pages')
    .select('id, handle, links')
    .in('profile_id', profileIds)
    .order('created_at', { ascending: true })
    .limit(1)

  const page = pages?.[0]
  if (!page) return NextResponse.json(null)

  // All clicks for this page
  const { data: allClicks } = await supabase
    .from('biolink_clicks')
    .select('link_index, clicked_at')
    .eq('page_id', page.id)
    .order('clicked_at', { ascending: false })

  const clicks = allClicks ?? []
  const now = Date.now()
  const d7 = now - 7 * 24 * 60 * 60 * 1000
  const d30 = now - 30 * 24 * 60 * 60 * 1000

  // KPIs
  const totalClicks = clicks.length
  const last7d = clicks.filter((c) => new Date(c.clicked_at as string).getTime() > d7).length
  const last30d = clicks.filter((c) => new Date(c.clicked_at as string).getTime() > d30).length

  // Daily clicks — last 30 days bucketed by date
  const dailyMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = 0
  }
  for (const c of clicks) {
    const key = (c.clicked_at as string).slice(0, 10)
    if (key in dailyMap) dailyMap[key]++
  }
  const dailyClicks = Object.entries(dailyMap).map(([date, count]) => ({ date, clicks: count }))

  // Per-link breakdown
  const linkCountMap: Record<number, number> = {}
  for (const c of clicks) {
    const idx = c.link_index as number
    linkCountMap[idx] = (linkCountMap[idx] ?? 0) + 1
  }
  const links = (page.links as Array<{ title: string; url: string }>) ?? []
  const linkBreakdown = links.map((l, i) => ({
    index: i,
    title: l.title,
    clicks: linkCountMap[i] ?? 0,
  })).sort((a, b) => b.clicks - a.clicks)

  return NextResponse.json({
    totalClicks,
    last7d,
    last30d,
    dailyClicks,
    linkBreakdown,
    handle: page.handle,
  })
}
