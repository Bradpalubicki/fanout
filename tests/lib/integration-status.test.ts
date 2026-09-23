import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTokens = vi.fn()
const mockResults = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => (table === 'oauth_tokens' ? mockTokens() : mockResults()),
    }),
  }),
}))

const { getIntegrationAudit, getVerifiedPlatforms } = await import('@/lib/integration-status')

function find(audit: Awaited<ReturnType<typeof getIntegrationAudit>>, platform: string) {
  const row = audit.find((r) => r.platform === platform)
  if (!row) throw new Error(`no row for ${platform}`)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTokens.mockResolvedValue({ data: [], error: null })
  mockResults.mockResolvedValue({ data: [], error: null })
  for (const k of Object.keys(process.env)) {
    if (k.endsWith('_CLIENT_ID') || k.endsWith('_CLIENT_SECRET') || k.endsWith('_APP_ID') || k.endsWith('_APP_SECRET') || k.endsWith('_CLIENT_KEY')) {
      delete process.env[k]
    }
  }
})

/**
 * The previous version of this module hardcoded six status literals and made
 * zero network calls, while its header claimed it verified each platform.
 * Two planning documents concluded "0 of 9 post in production, only Bluesky and
 * Mastodon work" from that output. Both halves were false.
 * These tests pin the rule: status is DERIVED from observed evidence.
 */
describe('getIntegrationAudit — status derivation', () => {
  it('reports NOT_CONFIGURED when there are no credentials and no history', async () => {
    const audit = await getIntegrationAudit()
    expect(find(audit, 'twitter').status).toBe('NOT_CONFIGURED')
    expect(find(audit, 'twitter').evidence).toMatch(/Nothing attempted/i)
  })

  // The exact bug: credentials present + nobody connected was reported BROKEN.
  it('reports AWAITING_CONNECTION, never broken, when creds exist but no one connected', async () => {
    process.env.TWITTER_CLIENT_ID = 'id'
    process.env.TWITTER_CLIENT_SECRET = 'secret'
    const row = find(await getIntegrationAudit(), 'twitter')
    expect(row.status).toBe('AWAITING_CONNECTION')
    expect(row.evidence).toMatch(/Untested, not broken/i)
  })

  it('treats the literal string "placeholder" as absent credentials', async () => {
    process.env.TWITTER_CLIENT_ID = 'placeholder'
    process.env.TWITTER_CLIENT_SECRET = 'placeholder'
    expect(find(await getIntegrationAudit(), 'twitter').status).toBe('NOT_CONFIGURED')
  })

  it('reports CONNECTED_UNPROVEN when a token exists but nothing was posted', async () => {
    mockTokens.mockResolvedValue({ data: [{ platform: 'linkedin' }], error: null })
    const row = find(await getIntegrationAudit(), 'linkedin')
    expect(row.status).toBe('CONNECTED_UNPROVEN')
    expect(row.tokensStored).toBe(1)
  })

  // Only a real platform_post_id proves a post landed.
  it('reports VERIFIED only when a post returned a real platform id', async () => {
    mockTokens.mockResolvedValue({ data: [{ platform: 'reddit' }], error: null })
    mockResults.mockResolvedValue({ data: [{ platform: 'reddit', platform_post_id: 't3_abc' }], error: null })
    const row = find(await getIntegrationAudit(), 'reddit')
    expect(row.status).toBe('VERIFIED')
    expect(row.successfulPosts).toBe(1)
  })

  it('reports FAILING when posts were attempted but none returned an id', async () => {
    mockResults.mockResolvedValue({ data: [{ platform: 'reddit', platform_post_id: null }], error: null })
    const row = find(await getIntegrationAudit(), 'reddit')
    expect(row.status).toBe('FAILING')
    expect(row.failedPosts).toBe(1)
  })

  it('prefers VERIFIED over FAILING when both exist (a platform that works sometimes works)', async () => {
    mockResults.mockResolvedValue({
      data: [
        { platform: 'reddit', platform_post_id: null },
        { platform: 'reddit', platform_post_id: 't3_ok' },
      ],
      error: null,
    })
    expect(find(await getIntegrationAudit(), 'reddit').status).toBe('VERIFIED')
  })

  /**
   * Bluesky and Mastodon were previously hardcoded to WORKING with no check.
   * They have no central OAuth app and so no env vars — they must derive from
   * stored accounts alone, and must never be VERIFIED without a real post.
   */
  it.each([['bluesky'], ['mastodon']])('never reports %s as verified without a real post', async (p) => {
    const row = find(await getIntegrationAudit(), p)
    expect(row.status).not.toBe('VERIFIED')
    expect(row.credentialsPresent).toBe(false)
  })

  it('reports bluesky VERIFIED once a real post exists', async () => {
    mockTokens.mockResolvedValue({ data: [{ platform: 'bluesky' }], error: null })
    mockResults.mockResolvedValue({ data: [{ platform: 'bluesky', platform_post_id: 'at://x' }], error: null })
    expect(find(await getIntegrationAudit(), 'bluesky').status).toBe('VERIFIED')
  })

  // A read failure must not masquerade as "nothing works".
  it('does not report platforms as broken when the db read fails', async () => {
    mockResults.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const audit = await getIntegrationAudit()
    expect(audit.every((r) => r.status !== 'FAILING')).toBe(true)
    expect(find(audit, 'twitter').evidence).toMatch(/status unknown, not measured/i)
  })

  it('carries external blockers as facts about the platform, not our status', async () => {
    const audit = await getIntegrationAudit()
    expect(find(audit, 'facebook').externalBlocker).toMatch(/Meta Business Verification/)
    expect(find(audit, 'reddit').externalBlocker).toBeNull()
  })
})

describe('getVerifiedPlatforms', () => {
  // This drives public "supported platforms" copy, so it must be provable.
  it('is empty when nothing has posted, even with credentials everywhere', async () => {
    process.env.TWITTER_CLIENT_ID = 'id'
    process.env.TWITTER_CLIENT_SECRET = 'secret'
    mockTokens.mockResolvedValue({ data: [{ platform: 'twitter' }], error: null })
    expect(await getVerifiedPlatforms()).toEqual([])
  })

  it('lists only platforms with a real landed post', async () => {
    mockResults.mockResolvedValue({
      data: [
        { platform: 'reddit', platform_post_id: 't3_ok' },
        { platform: 'twitter', platform_post_id: null },
      ],
      error: null,
    })
    expect(await getVerifiedPlatforms()).toEqual(['reddit'])
  })
})
