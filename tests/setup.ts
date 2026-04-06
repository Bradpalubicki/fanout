import { vi } from 'vitest'

// Mock Clerk auth — default: authenticated user with org
export const mockAuth = vi.fn().mockResolvedValue({
  userId: 'user_test123',
  orgId: 'org_test456',
})

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: vi.fn().mockResolvedValue({
    emailAddresses: [{ emailAddress: 'test@nustack.digital' }],
  }),
  clerkMiddleware: vi.fn(() => vi.fn()),
  createRouteMatcher: vi.fn(() => vi.fn()),
}))

// Mock Supabase — chainable query builder
export function createMockSupabase() {
  const mockResult = { data: null as unknown, error: null as unknown, count: null as number | null }

  const chainable = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {}
    const methods = [
      'from', 'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'in', 'or', 'not', 'lt', 'lte', 'gte', 'gt',
      'order', 'limit', 'single', 'maybeSingle', 'rpc',
    ]
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }
    // Terminal methods return the result
    chain.single = vi.fn().mockResolvedValue(mockResult)
    chain.maybeSingle = vi.fn().mockResolvedValue(mockResult)
    // select/insert/update/delete also resolve if awaited
    const resolving = vi.fn().mockReturnValue(
      Object.assign(chain, { then: (fn: (v: unknown) => void) => Promise.resolve(mockResult).then(fn) })
    )
    chain.select = resolving
    chain.insert = resolving
    chain.update = resolving
    chain.delete = resolving
    return chain
  }

  const supabase = {
    from: vi.fn().mockReturnValue(chainable()),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return { supabase, mockResult }
}

export const { supabase: mockSupabase, mockResult } = createMockSupabase()

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  getSupabase: () => mockSupabase,
}))

// Mock Inngest
export const mockInngestSend = vi.fn().mockResolvedValue({ ids: ['test-event-id'] })
vi.mock('@/lib/inngest', () => ({
  inngest: { send: mockInngestSend },
}))

// Mock crypto
vi.mock('@/lib/crypto', () => ({
  encryptToken: vi.fn((val: string) => Promise.resolve(`encrypted:${val}`)),
  decryptToken: vi.fn((val: string) => Promise.resolve(val.replace('encrypted:', ''))),
  generateStateToken: vi.fn(() => 'mock-state-token'),
  generatePkceVerifier: vi.fn(() => 'mock-pkce-verifier-43chars-minimum-length-ok'),
  hashApiKey: vi.fn((key: string) => `hash:${key}`),
  generateApiKey: vi.fn(() => 'fano_test_key_123'),
}))

// Mock rate limiting
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: new Date() }),
}))

// Mock subscriptions
vi.mock('@/lib/subscriptions', () => ({
  getOrCreateOrgSubscription: vi.fn().mockResolvedValue({ plan_key: 'agency', status: 'active' }),
  isSubscriptionActive: vi.fn().mockReturnValue(true),
  isTrialExpired: vi.fn().mockReturnValue(false),
  checkProfileLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

// Mock auth lib
vi.mock('@/lib/auth', () => ({
  verifyApiKey: vi.fn().mockResolvedValue({
    profile: {
      id: 'profile_abc',
      org_id: 'org_test456',
      name: 'Test Profile',
      slug: 'test-profile',
      api_key_hash: 'hash:test-key',
      webhook_url: null,
      timezone: 'UTC',
      created_at: '2026-01-01T00:00:00Z',
    },
  }),
}))
