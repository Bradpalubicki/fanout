import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPredicateDb, PRINCIPALS } from '../helpers/predicate-db'

/**
 * A/B/C tenant isolation probe for GET /api/v1/history.
 *
 * This is the gate the audit specified for every ported v1 route:
 *
 *   A's key vs A's resource         -> succeeds
 *   A's key vs sibling B (same org) -> discloses nothing
 *   A's key vs foreign-org C        -> discloses nothing
 *
 * Unlike tests/api/v1-history.test.ts, which records the filters a handler
 * builds and then returns canned rows regardless, the database here applies
 * those filters. Measured 2026-09-23: seeding a profile-B row into the old
 * fixture left all 18 of its tests passing, so that suite could not tell a
 * leaking handler from a correct one. These tests assert on the RESPONSE BODY,
 * so a missing or misdirected filter shows up as another tenant's data.
 *
 * What would FAIL these tests: removing .eq('profile_id', …) from either read,
 * filtering by org_id instead of profile_id, or honouring a caller-supplied
 * profile_id. Each is exercised as a mutation below the implementation.
 */

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()
const db = createPredicateDb()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => db.supabase.from(t) },
}))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))

const { GET } = await import('@/app/api/v1/history/route')

function req(qs = '') {
  const url = `https://fanout.digital/api/v1/history${qs}`
  const r = new Request(url, { headers: { authorization: 'Bearer key-A' } })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return r as unknown as Parameters<typeof GET>[0]
}

function post(profileId: string, orgId: string, id: string, publishedAt: string) {
  return {
    profile_id: profileId,
    // Present so an org-scoped filter MATCHES rather than matching nothing.
    // Without it, .eq(org_id, …) would silently return zero rows and the
    // org-scoped leak — the real-world defect — would look like a pass.
    org_id: orgId,
    platform: 'instagram',
    platform_post_id: id,
    platform_post_url: null,
    content: `content-of-${id}`,
    media_urls: null,
    published_at: publishedAt,
    origin: 'native',
    metrics: null,
    last_synced_at: publishedAt,
  }
}

function syncState(profileId: string, orgId: string, platform: string, imported: number) {
  return {
    profile_id: profileId,
    org_id: orgId,
    platform,
    backfill_completed_at: null,
    posts_imported: imported,
    last_error: null,
    last_run_at: '2026-09-23',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.calls.length = 0
  mockVerify.mockResolvedValue({ profile: PRINCIPALS.A })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })

  // All three tenants hold data simultaneously. A correct handler sees only A's.
  db.seed('external_posts', [
    post(PRINCIPALS.A.id, PRINCIPALS.A.org_id, 'A-1', '2026-09-03'),
    post(PRINCIPALS.A.id, PRINCIPALS.A.org_id, 'A-2', '2026-09-02'),
    post(PRINCIPALS.B.id, PRINCIPALS.B.org_id, 'B-SECRET', '2026-09-04'),
    post(PRINCIPALS.C.id, PRINCIPALS.C.org_id, 'C-SECRET', '2026-09-05'),
  ])
  // Every tenant has an INSTAGRAM row as well as a distinctive one. Without
  // the shared platform, a handler that filtered by platform instead of by
  // tenant would exclude B and C coincidentally and look correctly scoped —
  // measured: that exact mutation passed this probe until these rows existed.
  db.seed('external_post_sync_state', [
    syncState(PRINCIPALS.A.id, PRINCIPALS.A.org_id, 'instagram', 10),
    syncState(PRINCIPALS.B.id, PRINCIPALS.B.org_id, 'instagram', 999),
    syncState(PRINCIPALS.B.id, PRINCIPALS.B.org_id, 'facebook', 998),
    syncState(PRINCIPALS.C.id, PRINCIPALS.C.org_id, 'instagram', 777),
    syncState(PRINCIPALS.C.id, PRINCIPALS.C.org_id, 'twitter', 776),
  ])
})

describe('v1/history A/B/C — A reads A', () => {
  it("returns A's own posts", async () => {
    const body = await (await GET(req())).json()
    expect(body.posts.map((p: { platformPostId: string }) => p.platformPostId)).toEqual([
      'A-1',
      'A-2',
    ])
  })

  it("returns A's own sync state", async () => {
    const body = await (await GET(req())).json()
    expect(body.sync).toHaveLength(1)
    expect(body.sync[0]).toMatchObject({ platform: 'instagram', postsImported: 10 })
  })
})

describe('v1/history A/B/C — sibling profile B in the SAME org discloses nothing', () => {
  /**
   * B is the load-bearing case. A foreign org is excluded by any org-level
   * check; a sibling profile inside the same org is excluded only by a
   * PROFILE-level check. The defect this guards against — resolve an org, fan
   * out across its profiles — returns A and B while correctly excluding C, so
   * a probe without B passes on a live leak.
   */
  it("never returns B's posts", async () => {
    const raw = JSON.stringify(await (await GET(req())).json())
    expect(raw).not.toContain('B-SECRET')
    expect(raw).not.toContain(PRINCIPALS.B.id)
  })

  it("never returns B's sync state, not even the platform name", async () => {
    const body = await (await GET(req())).json()
    expect(body.sync.map((s: { platform: string }) => s.platform)).not.toContain('facebook')
  })

  it("never leaks B's post counts through sync visibility", async () => {
    const raw = JSON.stringify(await (await GET(req())).json())
    expect(raw).not.toContain('999')
  })
})

describe('v1/history A/B/C — foreign org C discloses nothing', () => {
  it("never returns C's posts", async () => {
    const raw = JSON.stringify(await (await GET(req())).json())
    expect(raw).not.toContain('C-SECRET')
    expect(raw).not.toContain(PRINCIPALS.C.id)
  })

  it("never returns C's sync state", async () => {
    const body = await (await GET(req())).json()
    expect(body.sync.map((s: { platform: string }) => s.platform)).not.toContain('twitter')
  })
})

describe('v1/history A/B/C — scope cannot be widened by the caller', () => {
  it('ignores a caller-supplied profile_id pointing at a sibling', async () => {
    const body = await (await GET(req('?profile_id=profile-B'))).json()
    expect(JSON.stringify(body)).not.toContain('B-SECRET')
    expect(body.posts.map((p: { platformPostId: string }) => p.platformPostId)).toEqual([
      'A-1',
      'A-2',
    ])
  })

  it('a platform filter narrows within A, it does not reach across tenants', async () => {
    // B owns the only facebook sync row; asking for facebook must not surface it.
    const body = await (await GET(req('?platform=facebook'))).json()
    expect(body.posts).toEqual([])
    expect(JSON.stringify(body)).not.toContain('999')
  })

  it('pagination cannot walk into another tenant', async () => {
    // B-SECRET and C-SECRET are the NEWEST rows. Ordering is newest-first, so
    // an unscoped read would put them on page one.
    const body = await (await GET(req('?limit=1'))).json()
    expect(body.posts[0].platformPostId).toBe('A-1')
    expect(JSON.stringify(body)).not.toContain('SECRET')
  })
})

describe('v1/history A/B/C — the boundary holds for a different principal', () => {
  /**
   * Re-running the same probe as B proves the handler scopes to WHOEVER the
   * key identifies, rather than happening to hardcode or favour A.
   */
  it("B's key reads B's posts and never A's", async () => {
    mockVerify.mockResolvedValue({ profile: PRINCIPALS.B })
    const body = await (await GET(req())).json()
    expect(body.posts.map((p: { platformPostId: string }) => p.platformPostId)).toEqual([
      'B-SECRET',
    ])
    expect(JSON.stringify(body)).not.toContain('A-1')
  })
})
