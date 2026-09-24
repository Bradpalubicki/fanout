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
    /**
     * Media was previously DISCARDED here without a word: payload.mediaUrls was
     * never read, so media_type was hardcoded to TEXT and a user who attached an
     * image saw "posted" with the image gone. Found 2026-09-24 — same defect
     * class as Twitter (cf9621f) and Reddit (6c0472a).
     *
     * Threads takes the image by URL rather than by upload: it fetches image_url
     * itself at container-creation time, which is why there is no bytes step
     * here the way there is on Reddit. The URL must be publicly reachable.
     *
     * Text-only posts keep the exact single-image-free container they had.
     */
    const containerBody: Record<string, string> = {
      media_type: 'TEXT',
      text: payload.content,
      access_token: accessToken,
    }

    if (payload.mediaUrls?.length) {
      // One image per container. Carousels need a different (CAROUSEL) flow
      // with per-child containers; extra urls are ignored rather than silently
      // merged into something the user did not ask for.
      containerBody.media_type = 'IMAGE'
      containerBody.image_url = payload.mediaUrls[0]
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
