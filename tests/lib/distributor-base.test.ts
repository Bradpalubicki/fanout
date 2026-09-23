import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BaseDistributor, RateLimitError, type PostPayload, type PostResult } from '@/distributors/base'
import type { AnalyticsSnapshot } from '@/lib/types'

class Probe extends BaseDistributor {
  platform = 'probe'
  async post(): Promise<PostResult> { return { success: false } }
  async refreshToken() { return { accessToken: '', expiresAt: new Date() } }
  async getAnalytics(): Promise<Partial<AnalyticsSnapshot>> { return {} }
  call(url: string, opts: RequestInit = {}) { return this.fetchJson<{ id?: string }>(url, opts) }
}

const probe = new Probe()
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

function stubFetch(res: Partial<Response> & { status: number }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    json: res.json ?? (async () => ({})),
    headers: res.headers ?? new Headers(),
  }))
}

/**
 * fetchJson is the ONE place every distributor learns whether a post succeeded.
 * fetch() RESOLVES on 4xx/5xx, so if `ok` ever stops reflecting the status a
 * REJECTED post is reported as published — the F2 class of bug, fleet-wide.
 */
describe('BaseDistributor.fetchJson', () => {
  it('reports ok=true only for 2xx', async () => {
    stubFetch({ status: 200, json: async () => ({ id: 'abc' }) })
    const r = await probe.call('https://x.test')
    expect(r.ok).toBe(true)
    expect(r.data.id).toBe('abc')
  })

  it.each([[400], [401], [403], [404], [500], [503]])(
    'reports ok=false for %s (fetch resolves — must not read as success)',
    async (status) => {
      stubFetch({ status, json: async () => ({ error: 'nope' }) })
      const r = await probe.call('https://x.test')
      expect(r.ok).toBe(false)
      expect(r.status).toBe(status)
    }
  )

  // 429 must surface as a typed error so callers back off instead of retrying hot.
  it('throws RateLimitError on 429 with the retry-after value', async () => {
    stubFetch({ status: 429, headers: new Headers({ 'retry-after': '120' }) })
    await expect(probe.call('https://x.test')).rejects.toMatchObject({
      name: 'RateLimitError', retryAfterSeconds: 120, platform: 'probe',
    })
  })

  it('defaults retry-after to 60s when the header is absent or unparseable', async () => {
    stubFetch({ status: 429, headers: new Headers() })
    await expect(probe.call('https://x.test')).rejects.toMatchObject({ retryAfterSeconds: 60 })
    stubFetch({ status: 429, headers: new Headers({ 'retry-after': 'soon' }) })
    await expect(probe.call('https://x.test')).rejects.toMatchObject({ retryAfterSeconds: 60 })
  })

  // A platform returning HTML/empty on error must not crash the fan-out.
  it('survives a non-JSON body without throwing', async () => {
    stubFetch({ status: 500, json: async () => { throw new SyntaxError('Unexpected token <') } })
    const r = await probe.call('https://x.test')
    expect(r.ok).toBe(false)
    expect(r.data).toEqual({})
  })
})

describe('RateLimitError', () => {
  it('is an Error carrying platform and retry seconds', () => {
    const e = new RateLimitError(30, 'twitter')
    expect(e).toBeInstanceOf(Error)
    expect(e.retryAfterSeconds).toBe(30)
    expect(e.platform).toBe('twitter')
  })
})
