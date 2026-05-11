import type { AnalyticsSnapshot } from '@/lib/types'

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    public readonly platform: string
  ) {
    super(`Rate limited by ${platform} — retry after ${retryAfterSeconds}s`)
    this.name = 'RateLimitError'
  }
}

export interface PostPayload {
  content: string
  mediaUrls?: string[]
  platformConfig?: Record<string, unknown>
}

export interface PostResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  error?: string
}

export interface RefreshResult {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
}

export abstract class BaseDistributor {
  abstract platform: string

  abstract post(payload: PostPayload, accessToken: string, pageId?: string): Promise<PostResult>

  abstract refreshToken(refreshToken: string): Promise<RefreshResult>

  abstract getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>>

  protected async fetchJson<T>(
    url: string,
    options: RequestInit
  ): Promise<{ ok: boolean; data: T; status: number }> {
    const res = await fetch(url, options)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      throw new RateLimitError(isNaN(retryAfter) ? 60 : retryAfter, this.platform)
    }
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data: data as T, status: res.status }
  }
}
