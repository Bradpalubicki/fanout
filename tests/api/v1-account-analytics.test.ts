import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()
const calls: Array<{ table: string; filters: Record<string, unknown> }> = []
let rows: unknown[] = []

function builder(table: string) {
  const filters: Record<string, unknown> = {}
  calls.push({ table, filters })
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'gte']) {
    chain[m] = vi.fn((...a: unknown[]) => { filters[m] = a; return self() })
  }
  chain.eq = vi.fn((col: string, val: unknown) => { filters[col] = val; return self() })
  chain.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null })
  return chain
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))

const { GET } = await import('@/app/api/v1/analytics/account/route')

function req(qs = '') {
  const url = `https://fanout.digital/api/v1/analytics/account${qs}`
  const r = new Request(url, { headers: { authorization: 'Bearer key-A' } })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return r as unknown as Parameters<typeof GET>[0]
}

const day = (d: string, followers: number, impressions = 0) => ({
  platform: 'bluesky', followers, following: 10, posts_count: 5,
  impressions, reach: null, profile_views: null, engagements: null,
  collected_for: d, collected_at: d,
})

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  rows = []
  mockVerify.mockResolvedValue({ profile: { id: 'profile-A', org_id: 'org-1' } })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })
})

describe('GET /api/v1/analytics/account — tenant boundary', () => {
  // The gate CX specified for every ported route.
  it('filters by the KEY profile, never by org', async () => {
    await GET(req())
    const q = calls.find((c) => c.table === 'account_analytics')
    expect(q?.filters.profile_id).toBe('profile-A')
    expect(q?.filters.org_id).toBeUndefined()
  })

  it('ignores a caller-supplied profile_id', async () => {
    await GET(req('?profile_id=profile-B'))
    expect(calls[0]?.filters.profile_id).toBe('profile-A')
  })

  it('rejects an invalid key before touching the database', async () => {
    mockVerify.mockResolvedValue({ error: 'Invalid API key', status: 401 })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(calls.length).toBe(0)
  })

  it('rate limits per profile', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, resetAt: new Date(Date.now() + 30_000) })
    const res = await GET(req())
    expect(res.status).toBe(429)
    expect(calls.length).toBe(0)
  })
})

describe('cumulative vs period — the double-count guard', () => {
  /**
   * followers is a RUNNING TOTAL. 400 on day one and 410 on day three means the
   * account has 410 and grew by 10 — never 810. Summing cumulative metrics is
   * the defect fixed in mobile/analytics on 2026-09-23.
   */
  it('reports the latest follower count, not a sum', async () => {
    rows = [day('2026-09-23', 410), day('2026-09-22', 405), day('2026-09-21', 400)]
    const body = await (await GET(req())).json()
    expect(body.platforms[0].current.followers).toBe(410)
  })

  it('computes growth from first and last reading', async () => {
    rows = [day('2026-09-23', 410), day('2026-09-21', 400)]
    const body = await (await GET(req())).json()
    expect(body.platforms[0].change.followers).toBe(10)
    expect(body.platforms[0].change.from).toBe('2026-09-21')
    expect(body.platforms[0].change.to).toBe('2026-09-23')
  })

  // An unknown change must not render as "no change".
  it('returns null growth when an endpoint is missing', async () => {
    rows = [
      { ...day('2026-09-23', 0), followers: null },
      { ...day('2026-09-21', 0), followers: null },
    ]
    const body = await (await GET(req())).json()
    expect(body.platforms[0].change.followers).toBeNull()
  })

  // Period metrics DO sum: each row is a distinct day's window.
  it('sums period metrics across days', async () => {
    rows = [day('2026-09-23', 410, 100), day('2026-09-22', 405, 250)]
    const body = await (await GET(req())).json()
    expect(body.platforms[0].periodTotals.impressions).toBe(350)
  })
})

describe('shape and honesty', () => {
  it('groups by platform and returns the full series for charting', async () => {
    rows = [
      day('2026-09-23', 410),
      { ...day('2026-09-23', 0), platform: 'facebook', followers: 88 },
    ]
    const body = await (await GET(req())).json()
    expect(body.platforms).toHaveLength(2)
    expect(body.platforms.find((p: { platform: string }) => p.platform === 'facebook').current.followers).toBe(88)
    expect(Array.isArray(body.platforms[0].series)).toBe(true)
  })

  /**
   * Without `collected`, an empty result is ambiguous: "no growth data" and
   * "nothing collected yet" look identical, and a client report would assert
   * the former.
   */
  it('distinguishes no-data from nothing-collected', async () => {
    rows = []
    const body = await (await GET(req())).json()
    expect(body.collected).toBe(false)
    expect(body.platforms).toEqual([])
  })

  it.each([['?days=0'], ['?days=366'], ['?days=abc']])('rejects %s', async (qs) => {
    expect((await GET(req(qs))).status).toBe(400)
  })

  it('applies the platform filter when supplied', async () => {
    await GET(req('?platform=bluesky'))
    expect(calls[0]?.filters.platform).toBe('bluesky')
  })
})
