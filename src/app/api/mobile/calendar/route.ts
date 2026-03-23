export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user
  const profileId = req.nextUrl.searchParams.get('profileId')
  const month = req.nextUrl.searchParams.get('month') // YYYY-MM

  if (!profileId) return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 })
  }

  // Verify profile belongs to user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Compute month range
  const [year, monthNum] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNum - 1, 1))
  const end = new Date(Date.UTC(year, monthNum, 1)) // exclusive

  // Posts where scheduled_for falls in month OR (scheduled_for is null and created_at falls in month)
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, status, scheduled_for, created_at')
    .eq('profile_id', profile.id)
    .or(
      `and(scheduled_for.gte.${start.toISOString()},scheduled_for.lt.${end.toISOString()}),and(scheduled_for.is.null,created_at.gte.${start.toISOString()},created_at.lt.${end.toISOString()})`
    )
    .order('created_at', { ascending: true })
    .limit(200)

  const result = (posts ?? []).map((p) => ({
    id: p.id as string,
    content: p.content as string,
    platforms: p.platforms as string[],
    status: p.status as string,
    scheduledFor: (p.scheduled_for as string | null) ?? null,
    createdAt: p.created_at as string,
  }))

  return NextResponse.json({ posts: result })
}
