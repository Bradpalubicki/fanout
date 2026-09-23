import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockCheckLimit = vi.fn()
const mockGetOrCreate = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: () => ({ select: () => ({ single: () => mockInsert() }) }) }) },
}))
vi.mock('@/lib/subscriptions', () => ({
  checkProfileLimit: (o: string) => mockCheckLimit(o),
  getOrCreateOrgSubscription: (o: string) => mockGetOrCreate(o),
}))

const { POST } = await import('@/app/api/v1/profiles/route')

const ADMIN_KEY = 'test_admin_key'
const VALID = { orgId: 'org_client_a', name: 'Client A', slug: 'client-a' }

function req(body: unknown, auth?: string | null) {
  return new Request('https://fanout.digital/api/v1/profiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth === null || auth === undefined ? {} : { authorization: auth }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FANOUT_ADMIN_KEY = ADMIN_KEY
  mockCheckLimit.mockResolvedValue({ allowed: true, limit: 25, current: 3, plan: 'agency', paywalled: false })
  mockInsert.mockResolvedValue({ data: { id: 'p1', org_id: VALID.orgId, slug: VALID.slug }, error: null })
})

describe('POST /api/v1/profiles — auth', () => {
  it('creates a profile with a valid admin key', async () => {
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.profile.id).toBe('p1')
    expect(typeof json.apiKey).toBe('string')
    expect(json.apiKey.length).toBe(64) // 32 random bytes, hex
  })

  it.each([
    ['no header', null],
    ['empty bearer', 'Bearer '],
    ['wrong key', 'Bearer wrong_key_value'],
    ['bare key, no scheme', ADMIN_KEY],
    ['basic auth', 'Basic dXNlcjpwYXNz'],
  ])('rejects %s with 401', async (_label, auth) => {
    const res = await POST(req(VALID, auth))
    expect(res.status).toBe(401)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  /**
   * /api/v1 is excluded from the Clerk matcher, so this handler is the ONLY
   * gate. If FANOUT_ADMIN_KEY is unset, a naive compare would be
   * undefined === undefined and provision profiles for anonymous callers.
   */
  it('rejects every caller when FANOUT_ADMIN_KEY is unset', async () => {
    delete process.env.FANOUT_ADMIN_KEY
    for (const auth of [null, 'Bearer ', 'Bearer anything', 'Bearer undefined']) {
      const res = await POST(req(VALID, auth))
      expect(res.status).toBe(401)
    }
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // A prefix check is not an auth check — a longer key sharing a prefix must fail.
  it('rejects a key that merely starts with the real key', async () => {
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}_extra`))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/profiles — validation', () => {
  it('rejects malformed JSON with 400', async () => {
    const res = await POST(req('{not json', `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(400)
  })

  it.each([
    ['missing orgId', { name: 'A', slug: 'a-b' }],
    ['missing name', { orgId: 'o', slug: 'a-b' }],
    ['missing slug', { orgId: 'o', name: 'Client A' }],
    ['uppercase slug', { orgId: 'o', name: 'Client A', slug: 'Client-A' }],
    ['slug with spaces', { orgId: 'o', name: 'Client A', slug: 'client a' }],
    ['slug with slash', { orgId: 'o', name: 'Client A', slug: 'a/../b' }],
    ['name too short', { orgId: 'o', name: 'A', slug: 'a-b' }],
    ['bad webhookUrl', { orgId: 'o', name: 'Client A', slug: 'a-b', webhookUrl: 'not-a-url' }],
  ])('rejects %s with 400 and never inserts', async (_l, body) => {
    const res = await POST(req(body, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('accepts an empty-string webhookUrl as "none"', async () => {
    const res = await POST(req({ ...VALID, webhookUrl: '' }, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(201)
  })
})

describe('POST /api/v1/profiles — plan limits', () => {
  it('returns 402 when the org is over its profile limit', async () => {
    mockCheckLimit.mockResolvedValue({ allowed: false, limit: 3, current: 3, plan: 'starter', paywalled: false })
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(402)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns 402 when the trial has expired', async () => {
    mockCheckLimit.mockResolvedValue({ allowed: false, limit: 0, current: 0, plan: 'starter', paywalled: true })
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(402)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // The limit must be evaluated for the org in the BODY, not a caller default.
  it('checks the limit against the requested orgId', async () => {
    await POST(req({ ...VALID, orgId: 'org_zzz' }, `Bearer ${ADMIN_KEY}`))
    expect(mockCheckLimit).toHaveBeenCalledWith('org_zzz')
  })
})

describe('POST /api/v1/profiles — conflicts', () => {
  it('maps a unique-violation to 409, not 500', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(409)
  })

  it('maps any other db error to 500', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection failure' } })
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}`))
    expect(res.status).toBe(500)
  })

  // The plaintext key is returned once and only hashed at rest.
  it('never returns the stored hash', async () => {
    const res = await POST(req(VALID, `Bearer ${ADMIN_KEY}`))
    const json = await res.json()
    expect(JSON.stringify(json)).not.toContain('api_key_hash')
  })
})
