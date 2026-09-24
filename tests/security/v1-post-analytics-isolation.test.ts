import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPredicateDb, PRINCIPALS } from '../helpers/predicate-db'

/**
 * A/B/C tenant isolation probe for GET /api/v1/analytics/[postId].
 *
 * This route is shaped differently from history and account analytics, and the
 * difference is the whole point of probing it. It reads a PARENT (posts)
 * scoped to the caller, then reads DESCENDANTS (post_results, and nested
 * analytics_snapshots) by post id alone. The descendant read carries no tenant
 * filter of its own — it is safe only because the parent read 404s first when
 * the post belongs to someone else.
 *
 * That makes the guarantee ORDER-DEPENDENT, which is the kind of property a
 * refactor breaks silently: move the results read above the ownership check,
 * or drop the `if (!post) return 404`, and a caller reads any post's
 * engagement numbers by guessing an id. The same bind-before-descendants
 * defect was already found once in this codebase, in dashboard/biolink's
 * clicksFor parameter.
 *
 * What would FAIL these tests: removing .eq('profile_id', …) from the posts
 * read, removing the 404 guard, or reordering the two reads. Each is
 * mutation-checked.
 */

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()
const db = createPredicateDb()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => db.supabase.from(t) },
}))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))

const { GET } = await import('@/app/api/v1/analytics/[postId]/route')

function req(postId: string) {
  const url = `https://fanout.digital/api/v1/analytics/${postId}`
  const r = new Request(url, { headers: { authorization: 'Bearer key-A' } })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return [
    r as unknown as Parameters<typeof GET>[0],
    { params: Promise.resolve({ postId }) } as Parameters<typeof GET>[1],
  ] as const
}

const A_POST = 'post-A'
const B_POST = 'post-B-secret'
const C_POST = 'post-C-secret'

const B_IMPRESSIONS = 999_111
const C_IMPRESSIONS = 888_222

function postRow(id: string, profileId: string, orgId: string, content: string) {
  return {
    id,
    profile_id: profileId,
    org_id: orgId,
    content,
    platforms: ['instagram'],
    status: 'posted',
    created_at: '2026-09-20',
  }
}

function resultRow(postId: string, impressions: number) {
  return {
    post_id: postId,
    platform: 'instagram',
    status: 'success',
    platform_post_id: `pp-${postId}`,
    platform_post_url: `https://example.com/${postId}`,
    posted_at: '2026-09-20',
    attempts: 1,
    analytics_snapshots: [
      {
        impressions,
        likes: 1,
        comments: 1,
        shares: 1,
        clicks: 1,
        reach: impressions,
        collected_at: '2026-09-21',
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.calls.length = 0
  mockVerify.mockResolvedValue({ profile: PRINCIPALS.A })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })

  db.seed('posts', [
    postRow(A_POST, PRINCIPALS.A.id, PRINCIPALS.A.org_id, 'A content'),
    postRow(B_POST, PRINCIPALS.B.id, PRINCIPALS.B.org_id, 'B PRIVATE CONTENT'),
    postRow(C_POST, PRINCIPALS.C.id, PRINCIPALS.C.org_id, 'C PRIVATE CONTENT'),
  ])
  db.seed('post_results', [
    resultRow(A_POST, 42),
    resultRow(B_POST, B_IMPRESSIONS),
    resultRow(C_POST, C_IMPRESSIONS),
  ])
})

describe('v1/analytics/[postId] A/B/C — A reads its own post', () => {
  it("returns A's own analytics", async () => {
    const res = await GET(...req(A_POST))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totals.impressions).toBe(42)
  })
})

describe('v1/analytics/[postId] A/B/C — sibling B in the SAME org discloses nothing', () => {
  it("404s on B's post id", async () => {
    const res = await GET(...req(B_POST))
    expect(res.status).toBe(404)
  })

  it("never returns B's impressions, even though post_results is read by id alone", async () => {
    const res = await GET(...req(B_POST))
    expect(JSON.stringify(await res.json())).not.toContain(String(B_IMPRESSIONS))
  })

  it("never returns B's post content", async () => {
    const res = await GET(...req(B_POST))
    expect(JSON.stringify(await res.json())).not.toContain('B PRIVATE CONTENT')
  })

  it("never reads post_results at all for a post A does not own", async () => {
    // The strongest form: the descendant table is never touched, so no amount
    // of downstream filtering is being relied on.
    await GET(...req(B_POST))
    expect(db.calls.filter((c) => c.table === 'post_results')).toEqual([])
  })

  it('does not distinguish a sibling post from a nonexistent one', async () => {
    // Same status AND same body, or the 404 becomes an existence oracle:
    // a caller could enumerate which post ids belong to other tenants.
    const sibling = await GET(...req(B_POST))
    const missing = await GET(...req('no-such-post'))
    expect(sibling.status).toBe(missing.status)
    expect(await sibling.json()).toEqual(await missing.json())
  })
})

describe('v1/analytics/[postId] A/B/C — foreign org C discloses nothing', () => {
  it("404s on C's post id", async () => {
    expect((await GET(...req(C_POST))).status).toBe(404)
  })

  it("never returns C's impressions", async () => {
    const res = await GET(...req(C_POST))
    expect(JSON.stringify(await res.json())).not.toContain(String(C_IMPRESSIONS))
  })
})

describe('v1/analytics/[postId] A/B/C — the boundary holds for a different principal', () => {
  it("B's key reads B's post and never A's", async () => {
    mockVerify.mockResolvedValue({ profile: PRINCIPALS.B })
    const res = await GET(...req(B_POST))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totals.impressions).toBe(B_IMPRESSIONS)
  })

  it("B's key 404s on A's post", async () => {
    mockVerify.mockResolvedValue({ profile: PRINCIPALS.B })
    expect((await GET(...req(A_POST))).status).toBe(404)
  })
})
