export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/v1/analytics/account — account-level metrics over time.
 *
 * Ayrshare sells this separately from per-post analytics because it answers a
 * different question: "is this client growing?" rather than "how did that post
 * do?". It is what an agency puts in a monthly client report.
 *
 * SCOPING: an API key identifies exactly ONE profile, so every query filters on
 * auth.profile.id and never on the profile's org. CX reproduced the alternative
 * on 2026-09-23 — resolving an org and fanning out across its profiles let
 * profile A read sibling profile B.
 */

const QuerySchema = z.object({
  platform: z.string().min(1).max(50).optional(),
  // Capped: an uncapped window lets one key pull the entire table.
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
})

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rl = await checkRateLimit(auth.profile.id)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. 100 requests per minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { platform, days } = parsed.data

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  let query = supabase
    .from('account_analytics')
    .select(
      'platform, followers, following, posts_count, impressions, reach, profile_views, engagements, collected_for, collected_at'
    )
    // THE tenant boundary. Never auth.profile.org_id.
    .eq('profile_id', auth.profile.id)
    .gte('collected_for', since)
    .order('collected_for', { ascending: false })

  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to read account analytics' }, { status: 500 })
  }

  const rows = data ?? []

  /**
   * Growth is computed from the FIRST and LAST reading in the window, never by
   * summing rows. followers is a running total: 400 on Monday and 410 on Friday
   * means +10, not 810. Summing cumulative metrics is the double-count defect
   * fixed in mobile/analytics on 2026-09-23, and it is the single easiest
   * mistake to make with this data.
   */
  const byPlatform = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byPlatform.get(row.platform) ?? []
    list.push(row)
    byPlatform.set(row.platform, list)
  }

  const platforms = [...byPlatform.entries()].map(([name, series]) => {
    // series is newest-first from the query above.
    const latest = series[0]
    const earliest = series[series.length - 1]

    const delta = (a?: number | null, b?: number | null) =>
      typeof a === 'number' && typeof b === 'number' ? a - b : null

    return {
      platform: name,
      current: {
        followers: latest?.followers ?? null,
        following: latest?.following ?? null,
        postsCount: latest?.posts_count ?? null,
        asOf: latest?.collected_for ?? null,
      },
      // Change across the window. Null when either endpoint is missing — an
      // unknown change must not render as zero change.
      change: {
        followers: delta(latest?.followers, earliest?.followers),
        postsCount: delta(latest?.posts_count, earliest?.posts_count),
        from: earliest?.collected_for ?? null,
        to: latest?.collected_for ?? null,
      },
      // Period metrics DO sum across days: each row is a distinct day's window,
      // unlike the cumulative fields above.
      periodTotals: {
        impressions: series.reduce((s, r) => s + (r.impressions ?? 0), 0),
        reach: series.reduce((s, r) => s + (r.reach ?? 0), 0),
        profileViews: series.reduce((s, r) => s + (r.profile_views ?? 0), 0),
        engagements: series.reduce((s, r) => s + (r.engagements ?? 0), 0),
      },
      // Full series so a caller can chart it rather than trusting our summary.
      series: series.map((r) => ({
        date: r.collected_for,
        followers: r.followers,
        following: r.following,
        postsCount: r.posts_count,
        impressions: r.impressions,
        reach: r.reach,
        profileViews: r.profile_views,
        engagements: r.engagements,
      })),
    }
  })

  return NextResponse.json({
    window: { days, since },
    platforms,
    // An empty result is ambiguous without this: "no growth data" and "nothing
    // collected yet" look identical, and a report would assert the former.
    collected: rows.length > 0,
  })
}
