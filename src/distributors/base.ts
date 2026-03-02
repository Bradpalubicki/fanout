import type { AnalyticsSnapshot } from '@/lib/types'

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

  abstract post(payload: PostPayload, accessToken: string): Promise<PostResult>

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
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data: data as T, status: res.status }
  }
}
