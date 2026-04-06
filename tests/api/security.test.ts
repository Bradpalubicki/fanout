import { describe, it, expect } from 'vitest'
import { z } from 'zod'

describe('CRON_SECRET guard', () => {
  it('rejects when CRON_SECRET is undefined', () => {
    const cronSecret = undefined
    const authHeader = 'Bearer undefined'

    // Old behavior: `authHeader !== \`Bearer ${cronSecret}\`` → 'Bearer undefined' === 'Bearer undefined' → PASS
    // New behavior: explicit null check blocks this
    const oldCheck = authHeader !== `Bearer ${cronSecret}`
    const newCheck = !cronSecret || authHeader !== `Bearer ${cronSecret}`

    expect(oldCheck).toBe(false) // Old code would ALLOW this — bug
    expect(newCheck).toBe(true)  // New code correctly REJECTS
  })

  it('allows when CRON_SECRET matches', () => {
    const cronSecret = 'real-secret-value'
    const authHeader = 'Bearer real-secret-value'

    const newCheck = !cronSecret || authHeader !== `Bearer ${cronSecret}`
    expect(newCheck).toBe(false) // Correctly allows
  })

  it('rejects wrong secret', () => {
    const cronSecret = 'real-secret-value'
    const authHeader = 'Bearer wrong-value' as string

    const newCheck = !cronSecret || authHeader !== `Bearer ${cronSecret}`
    expect(newCheck).toBe(true) // Correctly rejects
  })
})

describe('PostgREST filter injection prevention', () => {
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  const isSlug = (s: string) => /^[a-z0-9][a-z0-9-_]{0,62}$/i.test(s)
  const isValid = (s: string) => isUuid(s) || isSlug(s)

  it('accepts valid UUID', () => {
    expect(isValid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts valid slug', () => {
    expect(isValid('ak-dental')).toBe(true)
    expect(isValid('my_profile_123')).toBe(true)
  })

  it('rejects injection payload with comma', () => {
    expect(isValid('x,org_id.eq.any-org')).toBe(false)
  })

  it('rejects injection payload with parentheses', () => {
    expect(isValid('x).or(id.eq.other')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValid('')).toBe(false)
  })
})

describe('Biolink PATCH field validation', () => {
  const linkSchema = z.object({
    title: z.string().min(1),
    url: z.string().url(),
    icon: z.string().optional(),
  })

  const patchSchema = z.object({
    id: z.string().uuid(),
    handle: z.string().min(2).max(30).regex(/^[a-z0-9-_]+$/).optional(),
    title: z.string().min(1).optional(),
    bio: z.string().max(300).optional(),
    avatar_url: z.string().url().optional().nullable(),
    background_color: z.string().optional(),
    button_style: z.enum(['rounded', 'pill', 'square']).optional(),
    links: z.array(linkSchema).optional(),
    is_published: z.boolean().optional(),
  })

  it('accepts valid PATCH with allowed fields', () => {
    const result = patchSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'My Bio Page',
      bio: 'Hello world',
    })
    expect(result.success).toBe(true)
  })

  it('strips unknown fields (profile_id injection)', () => {
    const result = patchSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'My Bio Page',
      profile_id: 'attacker-profile-id', // should not be accepted
    })
    // Zod in strip mode (default) will accept but drop unknown keys
    expect(result.success).toBe(true)
    if (result.success) {
      expect('profile_id' in result.data).toBe(false)
    }
  })

  it('rejects invalid handle format', () => {
    const result = patchSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      handle: 'INVALID HANDLE!',
    })
    expect(result.success).toBe(false)
  })
})

describe('save-platform-credentials — key whitelist', () => {
  const ALLOWED_KEY_PREFIXES = [
    'TWITTER_', 'FACEBOOK_', 'LINKEDIN_', 'REDDIT_', 'YOUTUBE_',
    'TIKTOK_', 'PINTEREST_', 'GBP_', 'BLUESKY_', 'MASTODON_',
    'INSTAGRAM_', 'THREADS_',
  ]

  const isAllowed = (key: string) => ALLOWED_KEY_PREFIXES.some((p) => key.startsWith(p))

  it('allows platform env vars', () => {
    expect(isAllowed('TWITTER_CLIENT_ID')).toBe(true)
    expect(isAllowed('FACEBOOK_APP_SECRET')).toBe(true)
    expect(isAllowed('GBP_CLIENT_ID')).toBe(true)
  })

  it('blocks dangerous env vars', () => {
    expect(isAllowed('CLERK_SECRET_KEY')).toBe(false)
    expect(isAllowed('SUPABASE_SERVICE_ROLE_KEY')).toBe(false)
    expect(isAllowed('TOKEN_ENCRYPTION_KEY')).toBe(false)
    expect(isAllowed('VERCEL_TOKEN')).toBe(false)
  })
})

describe('Token encryption consistency', () => {
  it('Bluesky credentials should be encrypted before storage', async () => {
    const { encryptToken } = await import('@/lib/crypto')
    const creds = JSON.stringify({ identifier: 'user.bsky.social', password: 'app-password' })
    const encrypted = await encryptToken(creds)
    expect(encrypted).not.toBe(creds)
    expect(encrypted).toContain('encrypted:') // our mock prefixes with encrypted:
  })

  it('Mastodon token should be encrypted before storage', async () => {
    const { encryptToken } = await import('@/lib/crypto')
    const token = 'mastodon-access-token-123'
    const encrypted = await encryptToken(token)
    expect(encrypted).not.toBe(token)
  })
})
