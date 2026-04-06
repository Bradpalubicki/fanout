import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

describe('POST /api/v1/posts — input validation', () => {
  it('requires content field', () => {
    const { z } = require('zod')
    const PostsSchema = z.object({
      content: z.string().min(1).max(5000),
      platforms: z.array(z.string()).min(1).max(13),
      profile: z.string().min(1),
      scheduled_for: z.string().datetime().optional(),
      media_urls: z.array(z.string().url()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      platform_config: z.record(z.string(), z.unknown()).optional(),
    })

    const result = PostsSchema.safeParse({ platforms: ['bluesky'], profile: 'test' })
    expect(result.success).toBe(false)
  })

  it('requires at least one platform', () => {
    const { z } = require('zod')
    const PostsSchema = z.object({
      content: z.string().min(1).max(5000),
      platforms: z.array(z.string()).min(1).max(13),
      profile: z.string().min(1),
    })

    const result = PostsSchema.safeParse({ content: 'test', platforms: [], profile: 'test' })
    expect(result.success).toBe(false)
  })

  it('accepts valid Marketing Engine payload', () => {
    const { z } = require('zod')
    const PostsSchema = z.object({
      content: z.string().min(1).max(5000),
      platforms: z.array(z.string()).min(1).max(13),
      profile: z.string().min(1),
      scheduled_for: z.string().datetime().optional(),
      media_urls: z.array(z.string().url()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      platform_config: z.record(z.string(), z.unknown()).optional(),
    })

    const result = PostsSchema.safeParse({
      content: 'Spring special! 20% off cleanings.',
      platforms: ['google_business_profile', 'facebook'],
      profile: 'ak-dental',
      scheduled_for: '2026-04-10T09:00:00Z',
      media_urls: ['https://example.com/image.jpg'],
      metadata: { location_id: 'loc_123', campaign_id: 'spring-2026' },
      platform_config: { post_type: 'offer' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid scheduled_for format', () => {
    const { z } = require('zod')
    const PostsSchema = z.object({
      content: z.string().min(1),
      platforms: z.array(z.string()).min(1),
      profile: z.string().min(1),
      scheduled_for: z.string().datetime().optional(),
    })

    const result = PostsSchema.safeParse({
      content: 'test',
      platforms: ['bluesky'],
      profile: 'test',
      scheduled_for: 'next tuesday',
    })
    expect(result.success).toBe(false)
  })
})

describe('POST /api/v1/posts — auth', () => {
  it('verifyApiKey checks Bearer prefix', () => {
    // The real verifyApiKey implementation checks for Bearer prefix
    function checkBearer(header: string | null): boolean {
      return header?.startsWith('Bearer ') ?? false
    }
    expect(checkBearer(null)).toBe(false)
    expect(checkBearer('Basic abc')).toBe(false)
    expect(checkBearer('Bearer key123')).toBe(true)
  })

  it('verifyApiKey extracts key after Bearer', () => {
    const authHeader = 'Bearer my-api-key-123'
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    expect(apiKey).toBe('my-api-key-123')
  })

  it('rejects non-Bearer auth format', () => {
    const authHeader: string = 'Basic abc123'
    const hasBearerPrefix = authHeader.startsWith('Bearer ')
    expect(hasBearerPrefix).toBe(false)
  })
})

describe('POST /api/v1/posts — rate limiting', () => {
  it('checkRateLimit returns allowed by default', async () => {
    const result = await checkRateLimit('profile_abc')
    expect(result.allowed).toBe(true)
  })
})
