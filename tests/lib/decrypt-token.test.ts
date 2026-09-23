import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }))

const { decryptToken, TokenCorruptError, TokenDecryptUnavailableError } = await import('@/lib/crypto')

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TOKEN_ENCRYPTION_KEY = 'test_key'
})

/**
 * F1 contract. The split decides whether Inngest RETRIES or permanently SKIPS:
 *  - TokenCorruptError        -> skip + log. Retrying can never succeed.
 *  - TokenDecryptUnavailable  -> rethrow so the retry mechanism runs.
 * Misclassifying "unavailable" as "corrupt" silently discards a VALID
 * credential on a transient blip — the failure this suite exists to catch.
 */
describe('decryptToken error classification', () => {
  it('returns the plaintext on success', async () => {
    mockRpc.mockResolvedValue({ data: 'plaintext-token', error: null })
    await expect(decryptToken('cipher')).resolves.toBe('plaintext-token')
  })

  // Codes verified against the LIVE database: wrong key = 39000, malformed = 22023.
  it.each([['39000'], ['22023'], ['22P02'], ['39P01']])(
    'treats pg code %s as CORRUPT (skip, never retry)',
    async (code) => {
      mockRpc.mockResolvedValue({ data: null, error: { code, message: 'boom' } })
      await expect(decryptToken('cipher')).rejects.toBeInstanceOf(TokenCorruptError)
    }
  )

  it.each([['wrong key or corrupt data'], ['decryption_failed'], ['invalid input syntax for bytea']])(
    'treats message %s as CORRUPT',
    async (message) => {
      mockRpc.mockResolvedValue({ data: null, error: { message } })
      await expect(decryptToken('cipher')).rejects.toBeInstanceOf(TokenCorruptError)
    }
  )

  // A 5xx/timeout must NOT be mistaken for corruption or the credential is lost.
  it('treats an unrecognized db error as UNAVAILABLE (retryable)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'statement timeout' } })
    await expect(decryptToken('cipher')).rejects.toBeInstanceOf(TokenDecryptUnavailableError)
  })

  it('treats a thrown RPC call as UNAVAILABLE (retryable)', async () => {
    mockRpc.mockRejectedValue(new Error('ECONNRESET'))
    await expect(decryptToken('cipher')).rejects.toBeInstanceOf(TokenDecryptUnavailableError)
  })

  // An empty credential must never be handed to a distributor as if valid.
  it.each([[null], [''], [123]])('treats result %s as CORRUPT, not success', async (data) => {
    mockRpc.mockResolvedValue({ data, error: null })
    await expect(decryptToken('cipher')).rejects.toBeInstanceOf(TokenCorruptError)
  })

  // The two classes must stay distinguishable — collapsing them reintroduces F1.
  it('never classifies a transient failure as corrupt', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection failure' } })
    await expect(decryptToken('cipher')).rejects.not.toBeInstanceOf(TokenCorruptError)
  })
})
