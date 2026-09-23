import { describe, it, expect, vi, beforeEach } from 'vitest'

// Clerk is mocked: these tests assert the PREDICATE's logic, not Clerk itself.
const mockAuth = vi.fn()
const mockGetUser = vi.fn()
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  clerkClient: async () => ({ users: { getUser: mockGetUser } }),
}))

const { isNuStackAdmin } = await import('@/lib/nustack-admin')

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ userId: null })
  process.env.FANOUT_ADMIN_KEY = 'test_admin_key'
})

describe('isNuStackAdmin', () => {
  it('accepts the correct admin key', async () => {
    expect(await isNuStackAdmin('test_admin_key')).toBe(true)
  })

  it('rejects a wrong admin key', async () => {
    expect(await isNuStackAdmin('wrong_key')).toBe(false)
  })

  it('rejects a missing header when no session exists', async () => {
    expect(await isNuStackAdmin(null)).toBe(false)
  })

  /**
   * THE BYPASS THIS HELPER EXISTS TO CLOSE.
   * The previous inline check was `header === process.env.FANOUT_ADMIN_KEY`.
   * With the var unset that is `undefined === undefined` for a request sending
   * NO header — authorizing an anonymous caller. Must stay false.
   */
  it('rejects every caller when FANOUT_ADMIN_KEY is unset', async () => {
    delete process.env.FANOUT_ADMIN_KEY
    expect(await isNuStackAdmin(undefined)).toBe(false)
    expect(await isNuStackAdmin(null)).toBe(false)
    expect(await isNuStackAdmin('')).toBe(false)
    expect(await isNuStackAdmin('anything')).toBe(false)
  })

  it('rejects an empty-string key even when the env var is empty', async () => {
    process.env.FANOUT_ADMIN_KEY = ''
    expect(await isNuStackAdmin('')).toBe(false)
  })

  it('accepts a @nustack.digital session', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_1' })
    mockGetUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'brad@nustack.digital' } })
    expect(await isNuStackAdmin(null)).toBe(true)
  })

  it('rejects a non-staff session', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_2' })
    mockGetUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'john@opplv.org' } })
    expect(await isNuStackAdmin(null)).toBe(false)
  })

  // endsWith() is a suffix test: a lookalike domain must not pass.
  it('rejects a lookalike domain', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_3' })
    mockGetUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'evil@notnustack.digital' } })
    expect(await isNuStackAdmin(null)).toBe(false)
  })

  it('rejects a user with no primary email', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_4' })
    mockGetUser.mockResolvedValue({ primaryEmailAddress: null })
    expect(await isNuStackAdmin(null)).toBe(false)
  })
})
