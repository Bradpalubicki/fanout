import { describe, it, expect, vi, afterEach } from 'vitest'
import { AccountMetricsUnsupportedError } from '@/distributors/base'
import { BlueskyDistributor } from '@/distributors/bluesky'
import { FacebookDistributor } from '@/distributors/facebook'
import { LinkedInDistributor } from '@/distributors/linkedin'

afterEach(() => vi.unstubAllGlobals())

function stub(payload: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status, ok: status >= 200 && status < 300,
    json: async () => payload, headers: new Headers(),
  }))
}

/**
 * Account metrics answer "is this client growing?" — the question an agency
 * reports monthly. Different from per-post performance, which getAnalytics
 * already covers, and it needs different storage (account_analytics) because
 * analytics_snapshots is keyed on post_result_id.
 */
describe('getAccountMetrics default — unimplemented must be LOUD', () => {
  /**
   * A stub returning zeros is indistinguishable from an account that genuinely
   * has zero followers, and the collector would record that fiction as fact.
   */
  it('throws rather than returning zeros', async () => {
    await expect(new LinkedInDistributor().getAccountMetrics('tok')).rejects.toBeInstanceOf(
      AccountMetricsUnsupportedError
    )
  })

  it('names the platform so a failed collection is diagnosable', async () => {
    await expect(new LinkedInDistributor().getAccountMetrics('tok')).rejects.toThrow(/linkedin/i)
  })
})

describe('BlueskyDistributor.getAccountMetrics', () => {
  // Field names copied from a LIVE getProfile response on 2026-09-23.
  it('maps the live field names', async () => {
    stub({ followersCount: 412, followsCount: 28, postsCount: 7, handle: 'lockelum.bsky.social' })
    const m = await new BlueskyDistributor().getAccountMetrics('{"identifier":"a","password":"b"}')
    expect(m.followers).toBe(412)
    expect(m.following).toBe(28)
    expect(m.postsCount).toBe(7)
    expect(m.raw?.handle).toBe('lockelum.bsky.social')
  })

  // Bluesky has no impressions/reach. Omitting beats inventing a zero.
  it('leaves period metrics undefined rather than zero', async () => {
    stub({ followersCount: 1, followsCount: 1, postsCount: 1 })
    const m = await new BlueskyDistributor().getAccountMetrics('{"identifier":"a","password":"b"}')
    expect(m.impressions).toBeUndefined()
    expect(m.reach).toBeUndefined()
  })

  it('falls back to the stored identifier when no accountId is given', async () => {
    const f = vi.fn().mockResolvedValue({ status: 200, ok: true, headers: new Headers(), json: async () => ({}) })
    vi.stubGlobal('fetch', f)
    await new BlueskyDistributor().getAccountMetrics('{"identifier":"lockelum.bsky.social","password":"x"}')
    expect(f.mock.calls[0][0]).toContain('actor=lockelum.bsky.social')
  })

  it('throws when no actor can be determined', async () => {
    await expect(new BlueskyDistributor().getAccountMetrics('not-json')).rejects.toBeInstanceOf(
      AccountMetricsUnsupportedError
    )
  })

  it('throws on a provider error instead of reporting zeros', async () => {
    stub({ error: 'nope' }, 500)
    await expect(
      new BlueskyDistributor().getAccountMetrics('{"identifier":"a","password":"b"}')
    ).rejects.toThrow(/500/)
  })
})

describe('FacebookDistributor.getAccountMetrics', () => {
  it('requires a Page id — metrics belong to the Page, not the user', async () => {
    await expect(new FacebookDistributor().getAccountMetrics('tok')).rejects.toBeInstanceOf(
      AccountMetricsUnsupportedError
    )
  })

  it('prefers followers_count over the legacy fan_count', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(),
        json: async () => ({ followers_count: 500, fan_count: 480, name: 'LockeLum' }) })
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(), json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', f)
    const m = await new FacebookDistributor().getAccountMetrics('tok', 'PAGE1')
    expect(m.followers).toBe(500)
  })

  it('falls back to fan_count on older Pages', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(),
        json: async () => ({ fan_count: 480 }) })
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(), json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', f)
    const m = await new FacebookDistributor().getAccountMetrics('tok', 'PAGE1')
    expect(m.followers).toBe(480)
  })

  it('maps period insights separately from cumulative counts', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(),
        json: async () => ({ followers_count: 500 }) })
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(),
        json: async () => ({ data: [
          { name: 'page_impressions', values: [{ value: 1200 }] },
          { name: 'page_views_total', values: [{ value: 90 }] },
        ] }) })
    vi.stubGlobal('fetch', f)
    const m = await new FacebookDistributor().getAccountMetrics('tok', 'PAGE1')
    expect(m.followers).toBe(500)
    expect(m.impressions).toBe(1200)
    expect(m.profileViews).toBe(90)
  })

  /**
   * A new Page returns no insights. That must not discard the follower count —
   * partial data beats failing the whole read.
   */
  it('keeps cumulative counts when insights are unavailable', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(),
        json: async () => ({ followers_count: 500 }) })
      .mockResolvedValueOnce({ status: 400, ok: false, headers: new Headers(), json: async () => ({ error: {} }) })
    vi.stubGlobal('fetch', f)
    const m = await new FacebookDistributor().getAccountMetrics('tok', 'PAGE1')
    expect(m.followers).toBe(500)
    expect(m.impressions).toBeUndefined()
  })
})
