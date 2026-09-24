import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPredicateDb, PRINCIPALS } from '../helpers/predicate-db'

/**
 * A/B/C tenant isolation probe for the v1 WRITE routes: POST /v1/post and
 * POST /v1/schedule.
 *
 * These take a caller-supplied `profileId` in the body, which makes them the
 * only v1 routes where a caller names the tenant they want to act as. Two
 * separate things must hold, and passing one without the other is a defect:
 *
 *   1. Naming a sibling profile is REFUSED (404), not silently accepted.
 *   2. The row that gets written is attributed to the KEY's profile, never to
 *      the named one — so even if the gate were bypassed, the write could not
 *      land in another tenant's account.
 *
 * The second is what these tests assert on: the row actually inserted. A
 * handler that returned 404 while still writing, or that wrote using the
 * body's profileId, fails here regardless of its status code.
 */

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()
const mockEnqueue = vi.fn()
const db = createPredicateDb()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => db.supabase.from(t) },
}))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))
vi.mock('@/lib/enqueue', () => ({
  enqueuePostEvent: (...a: unknown[]) => mockEnqueue(...a),
}))
// v1/schedule calls inngest.send() directly rather than going through
// enqueuePostEvent, so it must be mocked separately or the test makes a real
// network call (observed: 401 Event key not found, 2.2s).
const mockInngestSend = vi.fn()
vi.mock('@/lib/inngest', () => ({
  inngest: { send: (...a: unknown[]) => mockInngestSend(...a) },
}))
vi.mock('@/lib/subscriptions', () => ({
  getOrCreateOrgSubscription: async () => ({ status: 'active' }),
  isSubscriptionActive: () => true,
  isTrialExpired: () => false,
}))

const { POST: createPost } = await import('@/app/api/v1/post/route')
const { POST: schedulePost } = await import('@/app/api/v1/schedule/route')

function req(body: unknown, path = '/post') {
  const url = `https://fanout.digital/api/v1${path}`
  const r = new Request(url, {
    method: 'POST',
    headers: { authorization: 'Bearer key-A', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return r as never
}

const BASE = { post: 'hello world', platforms: ['instagram'] }
const FUTURE = new Date(Date.now() + 86_400_000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  db.calls.length = 0
  db.seed('posts', [])
  mockVerify.mockResolvedValue({ profile: { ...PRINCIPALS.A, slug: 'a-slug' } })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })
  mockEnqueue.mockResolvedValue(true)
  mockInngestSend.mockResolvedValue({ ids: [] })
})

describe('v1/post — a caller cannot write into another tenant', () => {
  it("accepts a post naming the caller's own profile id", async () => {
    const res = await createPost(req({ ...BASE, profileId: PRINCIPALS.A.id }))
    expect(res.status).toBe(200)
    expect(db.rows('posts')).toHaveLength(1)
  })

  it("accepts the caller's own slug as well as its id", async () => {
    const res = await createPost(req({ ...BASE, profileId: 'a-slug' }))
    expect(res.status).toBe(200)
  })

  it('refuses a SIBLING profile id in the same org', async () => {
    const res = await createPost(req({ ...BASE, profileId: PRINCIPALS.B.id }))
    expect(res.status).toBe(404)
  })

  it('writes NOTHING when a sibling profile is named', async () => {
    await createPost(req({ ...BASE, profileId: PRINCIPALS.B.id }))
    expect(db.rows('posts')).toEqual([])
  })

  it('refuses a foreign-org profile id', async () => {
    const res = await createPost(req({ ...BASE, profileId: PRINCIPALS.C.id }))
    expect(res.status).toBe(404)
    expect(db.rows('posts')).toEqual([])
  })

  it('enqueues no fan-out job for a refused write', async () => {
    // A queued job would carry another tenant's profileId to the worker, where
    // the tuple guard (fan-out.ts) would then have to catch it. Defence should
    // not be deferred to the next layer.
    await createPost(req({ ...BASE, profileId: PRINCIPALS.B.id }))
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it("attributes the written row to the KEY's profile, not the body's", async () => {
    await createPost(req({ ...BASE, profileId: PRINCIPALS.A.id }))
    expect(db.rows('posts')[0]).toMatchObject({ profile_id: PRINCIPALS.A.id })
  })

  it("fans out under the KEY's profile id", async () => {
    await createPost(req({ ...BASE, profileId: PRINCIPALS.A.id }))
    const event = mockEnqueue.mock.calls[0][0] as { data: { profileId: string } }
    expect(event.data.profileId).toBe(PRINCIPALS.A.id)
  })
})

describe('v1/schedule — the same boundary on the scheduled path', () => {
  it('refuses a sibling profile id', async () => {
    const res = await schedulePost(
      req({ ...BASE, profileId: PRINCIPALS.B.id, scheduledFor: FUTURE }, '/schedule')
    )
    expect(res.status).toBe(404)
  })

  it('writes nothing when a sibling is named', async () => {
    await schedulePost(
      req({ ...BASE, profileId: PRINCIPALS.B.id, scheduledFor: FUTURE }, '/schedule')
    )
    expect(db.rows('posts')).toEqual([])
  })

  it("attributes a scheduled row to the KEY's profile", async () => {
    await schedulePost(
      req({ ...BASE, profileId: PRINCIPALS.A.id, scheduledFor: FUTURE }, '/schedule')
    )
    expect(db.rows('posts')[0]).toMatchObject({ profile_id: PRINCIPALS.A.id })
  })
})

describe('v1 writes — the boundary holds for a different principal', () => {
  it("B's key cannot write into A", async () => {
    mockVerify.mockResolvedValue({ profile: { ...PRINCIPALS.B, slug: 'b-slug' } })
    const res = await createPost(req({ ...BASE, profileId: PRINCIPALS.A.id }))
    expect(res.status).toBe(404)
    expect(db.rows('posts')).toEqual([])
  })

  it("B's key writes rows attributed to B", async () => {
    mockVerify.mockResolvedValue({ profile: { ...PRINCIPALS.B, slug: 'b-slug' } })
    await createPost(req({ ...BASE, profileId: PRINCIPALS.B.id }))
    expect(db.rows('posts')[0]).toMatchObject({ profile_id: PRINCIPALS.B.id })
  })
})

describe('v1 writes — attribution uses the profile ID, never the supplied alias', () => {
  /**
   * The ownership gate accepts EITHER the profile id or its slug, so on every
   * id-based path `profileId` and `auth.profile.id` are identical and a write
   * using the wrong one is invisible. Measured: mutating the insert to use the
   * body's profileId failed ZERO tests until this case existed.
   *
   * The slug path is the discriminator. A row keyed by slug would not join to
   * the profile, so history, analytics and fan-out would all miss it — and a
   * slug is caller-supplied, so it is the wrong thing to trust as an identity.
   */
  it('stores the profile id even when the caller authenticated by slug', async () => {
    await createPost(req({ ...BASE, profileId: 'a-slug' }))
    expect(db.rows('posts')[0]).toMatchObject({ profile_id: PRINCIPALS.A.id })
    expect(db.rows('posts')[0].profile_id).not.toBe('a-slug')
  })

  it('fans out under the profile id even when the caller used a slug', async () => {
    await createPost(req({ ...BASE, profileId: 'a-slug' }))
    const event = mockEnqueue.mock.calls[0][0] as { data: { profileId: string } }
    expect(event.data.profileId).toBe(PRINCIPALS.A.id)
  })

  it('schedules under the profile id even when the caller used a slug', async () => {
    await schedulePost(req({ ...BASE, profileId: 'a-slug', scheduledFor: FUTURE }, '/schedule'))
    expect(db.rows('posts')[0]).toMatchObject({ profile_id: PRINCIPALS.A.id })
  })
})
