import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPredicateDb, PRINCIPALS } from '../helpers/predicate-db'

/**
 * A/B/C tenant isolation probe for GET /api/v1/analytics/account.
 *
 * Same gate as v1-history-isolation: the database here APPLIES the handler's
 * filters rather than recording them, so a leak appears as another tenant's
 * numbers in the response body.
 *
 * Follower counts are the most sensitive field on this route. An agency
 * running several clients must never let one client read another's audience
 * size or growth — it is competitive intelligence, and a sibling profile in
 * the same org is exactly the pairing an agency has.
 *
 * Every tenant is seeded on the SAME platform (instagram) and the same dates,
 * with distinctive follower values. Platform and date therefore cannot
 * separate them — only tenancy can. That matters: a handler filtering by
 * platform would otherwise exclude siblings coincidentally and look correctly
 * scoped, which is a fixture bug that briefly weakened the history probe.
 */

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()
const db = createPredicateDb()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => db.supabase.from(t) },
}))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))

const { GET } = await import('@/app/api/v1/analytics/account/route')

function req(qs = '') {
  const url = `https://fanout.digital/api/v1/analytics/account${qs}`
  const r = new Request(url, { headers: { authorization: 'Bearer key-A' } })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return r as unknown as Parameters<typeof GET>[0]
}

/** Dates inside the default window, so `gte(collected_for, since)` keeps them. */
function today(offsetDays: number) {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function reading(
  profileId: string,
  orgId: string,
  followers: number,
  offsetDays: number,
  platform = 'instagram'
) {
  return {
    profile_id: profileId,
    org_id: orgId,
    platform,
    followers,
    following: 10,
    posts_count: 5,
    impressions: followers * 2,
    reach: followers,
    profile_views: 1,
    engagements: 1,
    collected_for: today(offsetDays),
    collected_at: today(offsetDays),
  }
}

// Distinctive, non-overlapping values so any leak is unambiguous in the body.
const A_LATEST = 410
const A_EARLIEST = 400
const B_SECRET_FOLLOWERS = 999_111
const C_SECRET_FOLLOWERS = 888_222

beforeEach(() => {
  vi.clearAllMocks()
  db.calls.length = 0
  mockVerify.mockResolvedValue({ profile: PRINCIPALS.A })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })

  db.seed('account_analytics', [
    reading(PRINCIPALS.A.id, PRINCIPALS.A.org_id, A_LATEST, 1),
    reading(PRINCIPALS.A.id, PRINCIPALS.A.org_id, A_EARLIEST, 5),
    // Sibling and foreign org, SAME platform and dates as A.
    reading(PRINCIPALS.B.id, PRINCIPALS.B.org_id, B_SECRET_FOLLOWERS, 1),
    reading(PRINCIPALS.B.id, PRINCIPALS.B.org_id, B_SECRET_FOLLOWERS - 100, 5),
    reading(PRINCIPALS.C.id, PRINCIPALS.C.org_id, C_SECRET_FOLLOWERS, 1),
  ])
})

describe('v1/analytics/account A/B/C — A reads A', () => {
  it("returns A's own follower count", async () => {
    const body = await (await GET(req())).json()
    expect(body.platforms).toHaveLength(1)
    expect(body.platforms[0].current.followers).toBe(A_LATEST)
  })

  it("computes change from A's own first and last reading", async () => {
    const body = await (await GET(req())).json()
    // 410 now vs 400 then = +10. Never 410+400.
    expect(body.platforms[0].change.followers).toBe(A_LATEST - A_EARLIEST)
  })
})

describe('v1/analytics/account A/B/C — sibling B in the SAME org discloses nothing', () => {
  it("never returns B's follower count", async () => {
    const raw = JSON.stringify(await (await GET(req())).json())
    expect(raw).not.toContain(String(B_SECRET_FOLLOWERS))
    expect(raw).not.toContain(PRINCIPALS.B.id)
  })

  it("B's readings never contaminate A's growth figure", async () => {
    const body = await (await GET(req())).json()
    // If B's rows were included, the newest-first series would start at B's
    // 999111 and growth would be a wildly different number.
    expect(body.platforms[0].change.followers).toBe(A_LATEST - A_EARLIEST)
  })

  it("never leaks B's impressions, which are derived from its follower count", async () => {
    const raw = JSON.stringify(await (await GET(req())).json())
    expect(raw).not.toContain(String(B_SECRET_FOLLOWERS * 2))
  })
})

describe('v1/analytics/account A/B/C — foreign org C discloses nothing', () => {
  it("never returns C's follower count", async () => {
    const raw = JSON.stringify(await (await GET(req())).json())
    expect(raw).not.toContain(String(C_SECRET_FOLLOWERS))
    expect(raw).not.toContain(PRINCIPALS.C.id)
  })
})

describe('v1/analytics/account A/B/C — scope cannot be widened by the caller', () => {
  it('ignores a caller-supplied profile_id pointing at a sibling', async () => {
    const raw = JSON.stringify(await (await GET(req('?profile_id=profile-B'))).json())
    expect(raw).not.toContain(String(B_SECRET_FOLLOWERS))
  })

  it('a platform filter narrows within A, it does not reach across tenants', async () => {
    const raw = JSON.stringify(await (await GET(req('?platform=instagram'))).json())
    expect(raw).not.toContain(String(B_SECRET_FOLLOWERS))
    expect(raw).not.toContain(String(C_SECRET_FOLLOWERS))
  })

  it('a wider day range cannot reach another tenant', async () => {
    const raw = JSON.stringify(await (await GET(req('?days=90'))).json())
    expect(raw).not.toContain(String(B_SECRET_FOLLOWERS))
    expect(raw).not.toContain(String(C_SECRET_FOLLOWERS))
  })
})

describe('v1/analytics/account A/B/C — the boundary holds for a different principal', () => {
  it("B's key reads B's numbers and never A's", async () => {
    mockVerify.mockResolvedValue({ profile: PRINCIPALS.B })
    const body = await (await GET(req())).json()
    expect(body.platforms[0].current.followers).toBe(B_SECRET_FOLLOWERS)
    expect(JSON.stringify(body)).not.toContain(String(A_LATEST))
  })
})
