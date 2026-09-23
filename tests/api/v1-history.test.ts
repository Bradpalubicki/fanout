import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()

/**
 * Captures the filters applied to each table so the tests can assert the tenant
 * boundary directly, rather than trusting that a handler "looks scoped".
 */
const calls: Array<{ table: string; filters: Record<string, unknown> }> = []

function builder(table: string, rows: unknown[]) {
  const filters: Record<string, unknown> = {}
  calls.push({ table, filters })
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'lt']) {
    chain[m] = vi.fn((...args: unknown[]) => {
      if (m === 'lt') filters.lt = args
      if (m === 'limit') filters.limit = args[0]
      if (m === 'order') filters.order = args
      return self()
    })
  }
  chain.eq = vi.fn((col: string, val: unknown) => {
    filters[col] = val
    return self()
  })
  // Terminal await resolves to the rows for this table.
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
  return chain
}

let externalRows: unknown[] = []
let syncRows: unknown[] = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      builder(table, table === 'external_posts' ? externalRows : syncRows),
  },
}))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))

const { GET } = await import('@/app/api/v1/history/route')

const PROFILE_A = { id: 'profile-A', org_id: 'org-1' }

// The handler reads req.nextUrl, which is a NextRequest property — a plain
// Request has only `url`. Attach it so the fixture matches the real runtime.
function req(qs = '') {
  const url = `https://fanout.digital/api/v1/history${qs}`
  const r = new Request(url, { headers: { authorization: 'Bearer key-A' } })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return r as unknown as Parameters<typeof GET>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  externalRows = []
  syncRows = []
  mockVerify.mockResolvedValue({ profile: PROFILE_A })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })
})

describe('GET /api/v1/history — tenant boundary', () => {
  /**
   * THE gate CX specified for every ported route: A's key must read A only.
   * The dashboard pattern resolves an org then fans out across its profiles,
   * which let profile A read sibling B. A sibling client's post history is
   * exactly what an agency must never leak between its own clients.
   */
  it('filters external_posts by the KEY profile, never by org', async () => {
    await GET(req())
    const q = calls.find((c) => c.table === 'external_posts')
    expect(q?.filters.profile_id).toBe('profile-A')
    expect(q?.filters.org_id).toBeUndefined()
  })

  it('scopes the sync-state read to the same profile', async () => {
    await GET(req())
    const q = calls.find((c) => c.table === 'external_post_sync_state')
    expect(q?.filters.profile_id).toBe('profile-A')
    expect(q?.filters.org_id).toBeUndefined()
  })

  // A caller cannot widen scope by supplying a profile id.
  it('ignores a caller-supplied profile_id', async () => {
    await GET(req('?profile_id=profile-B'))
    const q = calls.find((c) => c.table === 'external_posts')
    expect(q?.filters.profile_id).toBe('profile-A')
  })

  it('rejects an invalid key before touching the database', async () => {
    mockVerify.mockResolvedValue({ error: 'Invalid API key', status: 401 })
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(calls.length).toBe(0)
  })

  it('rate limits per profile and returns Retry-After', async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, resetAt: new Date(Date.now() + 30_000) })
    const res = await GET(req())
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(calls.length).toBe(0)
  })
})

describe('GET /api/v1/history — query handling', () => {
  it.each([
    ['limit=0', '?limit=0'],
    ['limit=101', '?limit=101'],
    ['limit=abc', '?limit=abc'],
    ['bad before', '?before=not-a-date'],
    ['bad origin', '?origin=elsewhere'],
  ])('rejects %s with 400', async (_l, qs) => {
    const res = await GET(req(qs))
    expect(res.status).toBe(400)
  })

  it('applies platform and origin filters when supplied', async () => {
    await GET(req('?platform=instagram&origin=native'))
    const q = calls.find((c) => c.table === 'external_posts')
    expect(q?.filters.platform).toBe('instagram')
    expect(q?.filters.origin).toBe('native')
  })

  /**
   * Ordering by discovery time would scramble history: a backfill imports old
   * posts "now", so every backfilled post would sort as if brand new.
   */
  it('orders by provider publish time, newest first', async () => {
    await GET(req())
    const q = calls.find((c) => c.table === 'external_posts')
    expect(q?.filters.order).toEqual(['published_at', { ascending: false, nullsFirst: false }])
  })

  // Offset pagination would skip or repeat rows as a backfill inserts older
  // posts underneath an open cursor; keyset on published_at does not.
  it('uses keyset pagination via `before`', async () => {
    await GET(req('?before=2026-09-01T00:00:00.000Z'))
    const q = calls.find((c) => c.table === 'external_posts')
    expect(q?.filters.lt).toEqual(['published_at', '2026-09-01T00:00:00.000Z'])
  })
})

describe('GET /api/v1/history — pagination', () => {
  const row = (id: string, at: string) => ({
    platform: 'instagram', platform_post_id: id, platform_post_url: null,
    content: null, media_urls: null, published_at: at, origin: 'native',
    metrics: null, last_synced_at: at,
  })

  it('reports hasMore and a cursor when another page exists', async () => {
    // limit=2 fetches 3; the extra row is the "more pages" signal.
    externalRows = [row('1', '2026-09-03'), row('2', '2026-09-02'), row('3', '2026-09-01')]
    const res = await GET(req('?limit=2'))
    const body = await res.json()
    expect(body.posts).toHaveLength(2)
    expect(body.pagination.hasMore).toBe(true)
    expect(body.pagination.nextBefore).toBe('2026-09-02')
  })

  it('reports no cursor on the final page', async () => {
    externalRows = [row('1', '2026-09-03')]
    const body = await (await GET(req('?limit=2'))).json()
    expect(body.pagination.hasMore).toBe(false)
    expect(body.pagination.nextBefore).toBeNull()
  })

  it('never returns the extra probe row to the caller', async () => {
    externalRows = [row('1', '2026-09-03'), row('2', '2026-09-02')]
    const body = await (await GET(req('?limit=1'))).json()
    expect(body.posts.map((p: { platformPostId: string }) => p.platformPostId)).toEqual(['1'])
  })
})

describe('GET /api/v1/history — sync visibility', () => {
  /**
   * Without sync state an empty list is ambiguous: "this client has never
   * posted" and "we have not imported yet" look identical, and an AI agent
   * would confidently assert the former.
   */
  it('reports backfill state so empty is not mistaken for no history', async () => {
    syncRows = [{
      platform: 'instagram', backfill_completed_at: null,
      posts_imported: 40, last_error: null, last_run_at: '2026-09-23',
    }]
    const body = await (await GET(req())).json()
    expect(body.posts).toEqual([])
    expect(body.sync[0]).toMatchObject({
      platform: 'instagram', backfillComplete: false, postsImported: 40,
    })
  })

  it('explains platforms that cannot support native history', async () => {
    syncRows = [{
      platform: 'linkedin', backfill_completed_at: '2026-09-23',
      posts_imported: 0, last_error: 'closed permission', last_run_at: '2026-09-23',
    }]
    const body = await (await GET(req())).json()
    expect(body.sync[0].nativeHistorySupported).toBe(false)
    expect(body.sync[0].unsupportedReason).toMatch(/closed/i)
  })
})
