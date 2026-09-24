import { describe, it, expect, vi, beforeEach } from 'vitest'

// The action writes Vercel PRODUCTION env vars. Before the fix it required only
// a signed-in session and accepted ARBITRARY env-var names, so any authenticated
// user could overwrite any production variable. These tests pin both halves:
// who may call it, and which keys it will forward.

const mockAuth = vi.fn()
const mockGetUser = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: async () => ({ users: { getUser: mockGetUser } }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Read at MODULE LOAD by the action, so they must be set before the import
// below — setting them in beforeEach is too late.
process.env.VERCEL_TOKEN = 'tok'
process.env.VERCEL_PROJECT_ID = 'prj'

const { savePlatformCredentials } = await import('@/app/actions/save-platform-credentials')

function signedInAs(email: string) {
  mockAuth.mockResolvedValue({ userId: 'user_1' })
  mockGetUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: email } })
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.FANOUT_ADMIN_KEY
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}), text: async () => '' })
})

describe('savePlatformCredentials authorization', () => {
  it('refuses an ordinary signed-in user and issues NO Vercel write', async () => {
    signedInAs('someone@example.com')
    const res = await savePlatformCredentials('twitter', {
      TWITTER_CLIENT_ID: 'x',
    })
    expect(res.success).toBe(false)
    // The discriminating assertion: not merely a false result, but no call at all.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const res = await savePlatformCredentials('twitter', { TWITTER_CLIENT_ID: 'x' })
    expect(res.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows NuStack staff', async () => {
    signedInAs('brad@nustack.digital')
    const res = await savePlatformCredentials('twitter', { TWITTER_CLIENT_ID: 'x' })
    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
  })
})

describe('savePlatformCredentials key allowlist', () => {
  it('refuses an env var that is not a platform credential', async () => {
    signedInAs('brad@nustack.digital')
    const res = await savePlatformCredentials('twitter', {
      CLERK_SECRET_KEY: 'sk_live_attacker',
    })
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/not a writable credential key/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses the whole batch when one key is unlisted', async () => {
    signedInAs('brad@nustack.digital')
    const res = await savePlatformCredentials('twitter', {
      TWITTER_CLIENT_ID: 'legit',
      SUPABASE_SERVICE_ROLE_KEY: 'stolen',
    })
    expect(res.success).toBe(false)
    // All-or-nothing: a partial write would still land the legitimate key and
    // make the rejection look harmless.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts a known platform credential key', async () => {
    signedInAs('brad@nustack.digital')
    const res = await savePlatformCredentials('reddit', {
      REDDIT_CLIENT_ID: 'a',
      REDDIT_CLIENT_SECRET: 'b',
    })
    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
