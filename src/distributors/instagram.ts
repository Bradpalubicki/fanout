import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class InstagramDistributor extends BaseDistributor {
  platform = 'instagram'

  async post(
    payload: PostPayload,
    accessToken: string,
    igUserId?: string
  ): Promise<PostResult> {
    if (!igUserId) {
      return { success: false, error: 'Instagram user ID required' }
    }

    if (!payload.mediaUrls?.length) {
      return { success: false, error: 'Instagram requires at least one image or video URL' }
    }

    // Step 1: Create media container
    const { ok: containerOk, data: containerData } = await this.fetchJson<{
      id?: string
      error?: { message: string }
    }>(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: payload.mediaUrls[0],
        caption: payload.content,
        access_token: accessToken,
      }),
    })

    if (!containerOk || !containerData.id) {
      return {
        success: false,
        error: containerData.error?.message ?? 'Instagram media container creation failed',
      }
    }

    // Step 2: Publish container
    const { ok, data } = await this.fetchJson<{ id?: string; error?: { message: string } }>(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
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
        error: data.error?.message ?? 'Instagram publish failed',
      }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.instagram.com/p/${data.id}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: { message: string }
    }>(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`,
      {}
    )

    if (!ok || !data.access_token) {
      throw new Error(data.error?.message ?? 'Instagram token refresh failed')
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
      like_count?: number
      comments_count?: number
    }>(
      `https://graph.facebook.com/v19.0/${platformPostId}?fields=like_count,comments_count&access_token=${accessToken}`,
      {}
    )

    if (!ok) return {}
    return {
      likes: data.like_count,
      comments: data.comments_count,
    }
  }
}
