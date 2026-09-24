import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPredicateDb, PRINCIPALS } from '../helpers/predicate-db'

/**
 * A/B/C tenant isolation probe for the three v1/platforms routes.
 *
 * These read and WRITE oauth_tokens — the credential table. Two distinct
 * boundaries are at stake, and the second is the more serious:
 *
 *   READ  (GET /v1/platforms, GET /v1/platforms/status)
 *         disclosure — which accounts a tenant has connected, under what
 *         username. /status in particular reports connection EXISTENCE per
 *         platform, which is exactly what a sibling must not learn.
 *
 *   WRITE (DELETE /v1/platforms/[platform])
 *         destruction — an unscoped delete does not merely disclose another
 *         tenant's connection, it REVOKES it. The predicate database actually
 *         removes matching rows, so these tests assert on what SURVIVED.
 *
 * Every principal is seeded with the SAME platform (instagram) so platform
 * cannot separate them — only tenancy can.
 */

const mockVerify = vi.fn()
const mockRateLimit = vi.fn()
const db = createPredicateDb()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => db.supabase.from(t) },
}))
vi.mock('@/lib/auth', () => ({ verifyApiKey: (h: string | null) => mockVerify(h) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: (id: string) => mockRateLimit(id) }))

const { GET: listPlatforms } = await import('@/app/api/v1/platforms/route')
const { GET: platformStatus } = await import('@/app/api/v1/platforms/status/route')
const { DELETE: disconnect } = await import('@/app/api/v1/platforms/[platform]/route')

function req(path = '') {
  const url = `https://fanout.digital/api/v1/platforms${path}`
  const r = new Request(url, { headers: { authorization: 'Bearer key-A' } })
  Object.defineProperty(r, 'nextUrl', { value: new URL(url) })
  return r as never
}

const A_USERNAME = 'a_public_handle'
const B_SECRET_USERNAME = 'b_secret_handle'
const C_SECRET_USERNAME = 'c_secret_handle'

function token(profileId: string, orgId: string, platform: string, username: string) {
  return {
    profile_id: profileId,
    org_id: orgId,
    platform,
    platform_username: username,
    platform_user_id: `uid-${username}`,
    expires_at: null,
    scopes: ['read'],
    created_at: '2026-09-01',
    updated_at: '2026-09-01',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.calls.length = 0
  mockVerify.mockResolvedValue({ profile: PRINCIPALS.A })
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: new Date() })

  db.seed('oauth_tokens', [
    token(PRINCIPALS.A.id, PRINCIPALS.A.org_id, 'instagram', A_USERNAME),
    // Sibling and foreign org on the SAME platform as A.
    token(PRINCIPALS.B.id, PRINCIPALS.B.org_id, 'instagram', B_SECRET_USERNAME),
    token(PRINCIPALS.B.id, PRINCIPALS.B.org_id, 'twitter', `${B_SECRET_USERNAME}_tw`),
    token(PRINCIPALS.C.id, PRINCIPALS.C.org_id, 'instagram', C_SECRET_USERNAME),
  ])
  db.seed('oauth_audit_log', [])
})

describe('v1/platforms GET — connection list is tenant scoped', () => {
  it("returns A's own connection", async () => {
    const body = await (await listPlatforms(req())).json()
    expect(body.platforms).toHaveLength(1)
    expect(body.platforms[0].username).toBe(A_USERNAME)
  })

  it("never discloses a sibling's connected username", async () => {
    const raw = JSON.stringify(await (await listPlatforms(req())).json())
    expect(raw).not.toContain(B_SECRET_USERNAME)
    expect(raw).not.toContain(PRINCIPALS.B.id)
  })

  it("never discloses a foreign org's connected username", async () => {
    const raw = JSON.stringify(await (await listPlatforms(req())).json())
    expect(raw).not.toContain(C_SECRET_USERNAME)
  })

  it('never returns an access token, even scoped correctly', async () => {
    // The select list omits access_token; this pins that it stays omitted.
    const raw = JSON.stringify(await (await listPlatforms(req())).json())
    expect(raw).not.toContain('access_token')
  })
})

describe('v1/platforms/status — connection EXISTENCE is tenant scoped', () => {
  /**
   * /status reduces tokens to a per-platform boolean. A leak here is quieter
   * than a username disclosure but still tells a sibling which accounts
   * another client runs.
   */
  it("reports A's own platform as connected", async () => {
    const body = await (await platformStatus(req('/status'))).json()
    const ig = body.platforms.find((p: { platform: string }) => p.platform === 'instagram')
    expect(ig?.connected).toBe(true)
  })

  it("does not report a platform as connected when only a SIBLING has it", async () => {
    // Only B holds a twitter token. A must see twitter as disconnected.
    const body = await (await platformStatus(req('/status'))).json()
    const tw = body.platforms.find((p: { platform: string }) => p.platform === 'twitter')
    expect(tw?.connected).toBe(false)
  })

  it("a principal with NO connections sees everything disconnected", async () => {
    mockVerify.mockResolvedValue({ profile: { id: 'profile-empty', org_id: 'org-1' } })
    const body = await (await platformStatus(req('/status'))).json()
    expect(body.platforms.every((p: { connected: boolean }) => !p.connected)).toBe(true)
  })
})

describe('v1/platforms/[platform] DELETE — revocation cannot cross tenants', () => {
  function delReq(platform: string): Parameters<typeof disconnect> {
    return [req(`/${platform}`), { params: Promise.resolve({ platform }) }]
  }

  it("deletes A's own token", async () => {
    await disconnect(...delReq('instagram'))
    const survivors = db.rows('oauth_tokens')
    expect(survivors.find((r) => r.profile_id === PRINCIPALS.A.id)).toBeUndefined()
  })

  it("leaves the SIBLING's token on the same platform intact", async () => {
    // The sharpest case: A and B both have instagram. A delete filtered only
    // by platform would revoke B's connection too.
    await disconnect(...delReq('instagram'))
    const survivors = db.rows('oauth_tokens')
    expect(
      survivors.find(
        (r) => r.profile_id === PRINCIPALS.B.id && r.platform === 'instagram'
      )
    ).toBeDefined()
  })

  it("leaves the foreign org's token on the same platform intact", async () => {
    await disconnect(...delReq('instagram'))
    const survivors = db.rows('oauth_tokens')
    expect(
      survivors.find(
        (r) => r.profile_id === PRINCIPALS.C.id && r.platform === 'instagram'
      )
    ).toBeDefined()
  })

  it('destroys exactly one row — never a whole platform across tenants', async () => {
    const before = db.rows('oauth_tokens').length
    await disconnect(...delReq('instagram'))
    expect(db.rows('oauth_tokens')).toHaveLength(before - 1)
  })

  it("a platform only a SIBLING has connected destroys nothing", async () => {
    // A has no twitter token; B does. Disconnecting twitter as A must be a
    // no-op, not a revocation of B's.
    const before = db.rows('oauth_tokens').length
    await disconnect(...delReq('twitter'))
    expect(db.rows('oauth_tokens')).toHaveLength(before)
    expect(
      db.rows('oauth_tokens').find((r) => r.profile_id === PRINCIPALS.B.id && r.platform === 'twitter')
    ).toBeDefined()
  })

  it('attributes the audit entry to the acting profile', async () => {
    await disconnect(...delReq('instagram'))
    const log = db.rows('oauth_audit_log')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ profile_id: PRINCIPALS.A.id, action: 'revoke' })
  })
})

describe('v1/platforms — the boundary holds for a different principal', () => {
  it("B's key lists B's connections and never A's", async () => {
    mockVerify.mockResolvedValue({ profile: PRINCIPALS.B })
    const body = await (await listPlatforms(req())).json()
    const names = body.platforms.map((p: { username: string }) => p.username)
    expect(names).toContain(B_SECRET_USERNAME)
    expect(names).not.toContain(A_USERNAME)
  })
})
