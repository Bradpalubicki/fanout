export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'

/**
 * GET /api/v1/history — posts this ACCOUNT published, including ones created
 * outside Fanout. The Ayrshare-parity endpoint: an AI agent reads a client's
 * real posting history to write in their voice, and most of that history
 * predates us.
 *
 * SCOPING — the whole point of this file.
 * An API key identifies exactly ONE profile. Every query here filters on
 * auth.profile.id, never on the profile's org. CX reproduced the alternative on
 * 2026-09-24: adapting a dashboard handler that resolves an org and fans out
 * across its profiles let profile A read (and act through) sibling profile B.
 * A sibling client's post history is exactly the data an agency must never leak
 * between its own clients.
 */

const QuerySchema = z.object({
  platform: z.string().min(1).max(50).optional(),
  // Page size is capped: an uncapped limit lets one key pull the entire table
  // in a single request.
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  // Keyset pagination on published_at. Offset pagination would skip or repeat
  // rows as a backfill inserts older posts underneath an open cursor.
  before: z.string().datetime().optional(),
  origin: z.enum(['native', 'fanout']).optional(),
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

  const { platform, limit, before, origin } = parsed.data

  let query = supabase
    .from('external_posts')
    .select(
      'platform, platform_post_id, platform_post_url, content, media_urls, published_at, origin, metrics, last_synced_at'
    )
    // THE tenant boundary. Never auth.profile.org_id.
    .eq('profile_id', auth.profile.id)
    // Newest first by PROVIDER publish time, not discovery time: a backfill
    // imports old posts "now", so ordering by discovery scrambles history.
    .order('published_at', { ascending: false, nullsFirst: false })
    // Fetch one extra row to detect a further page without a second count query.
    .limit(limit + 1)

  if (platform) query = query.eq('platform', platform)
  if (origin) query = query.eq('origin', origin)
  if (before) query = query.lt('published_at', before)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to read history' }, { status: 500 })
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const posts = hasMore ? rows.slice(0, limit) : rows

  // Keyset cursor: the caller passes this back as `before`.
  const nextBefore = hasMore ? posts[posts.length - 1]?.published_at ?? null : null

  // Report sync state so a caller can tell "no posts" from "not imported yet".
  // Without this an empty list is ambiguous, and an agent would confidently
  // conclude a client has never posted.
  const { data: syncRows } = await supabase
    .from('external_post_sync_state')
    .select('platform, backfill_completed_at, posts_imported, last_error, last_run_at')
    .eq('profile_id', auth.profile.id)

  const sync = (syncRows ?? []).map((s) => ({
    platform: s.platform,
    backfillComplete: !!s.backfill_completed_at,
    postsImported: s.posts_imported,
    lastRunAt: s.last_run_at,
    lastError: s.last_error,
    // Surfaced so a caller is never left guessing why a platform is absent.
    nativeHistorySupported: OAUTH_CONFIGS[s.platform]?.nativeHistory ?? false,
    unsupportedReason: OAUTH_CONFIGS[s.platform]?.nativeHistoryBlocker ?? null,
  }))

  return NextResponse.json({
    posts: posts.map((p) => ({
      platform: p.platform,
      platformPostId: p.platform_post_id,
      platformPostUrl: p.platform_post_url,
      content: p.content,
      mediaUrls: p.media_urls ?? [],
      publishedAt: p.published_at,
      origin: p.origin,
      // Cumulative provider counters at last sync. Never sum these across
      // syncs — they are running totals, not deltas.
      metrics: p.metrics ?? {},
      lastSyncedAt: p.last_synced_at,
    })),
    pagination: { limit, hasMore, nextBefore },
    sync,
  })
}
