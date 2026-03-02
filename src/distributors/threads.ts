import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class ThreadsDistributor extends BaseDistributor {
  platform = 'threads'

  async post(
    payload: PostPayload,
    accessToken: string,
    userId?: string
  ): Promise<PostResult> {
    if (!userId) {
      return { success: false, error: 'Threads user ID required' }
    }

    // Step 1: Create container
    const containerBody: Record<string, string> = {
      media_type: 'TEXT',
      text: payload.content,
      access_token: accessToken,
    }

    const { ok: containerOk, data: containerData } = await this.fetchJson<{
      id?: string
      error?: { message: string }
    }>(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    })

    if (!containerOk || !containerData.id) {
      return {
        success: false,
        error: containerData.error?.message ?? 'Threads container creation failed',
      }
    }

    // Step 2: Publish
    const { ok, data } = await this.fetchJson<{ id?: string; error?: { message: string } }>(
      `https://graph.threads.net/v1.0/${userId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken,
        }),
      }
    )

    if (!ok || !data.id) {
      return {
        success: false,
        error: data.error?.message ?? 'Threads publish failed',
      }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.threads.net`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: { message: string }
    }>(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${refreshToken}`,
      {}
    )

    if (!ok || !data.access_token) {
      throw new Error(data.error?.message ?? 'Threads token refresh failed')
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 5184000) * 1000),
    }
  }

  async getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    const { ok, data } = await this.fetchJson<{
      likes?: { summary: { total_count: number } }
      replies?: { summary: { total_count: number } }
    }>(
      `https://graph.threads.net/v1.0/${platformPostId}?fields=likes,replies&access_token=${accessToken}`,
      {}
    )

    if (!ok) return {}
    return {
      likes: data.likes?.summary?.total_count,
      comments: data.replies?.summary?.total_count,
    }
  }
}
