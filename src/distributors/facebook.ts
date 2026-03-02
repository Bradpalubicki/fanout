import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class FacebookDistributor extends BaseDistributor {
  platform = 'facebook'

  async post(
    payload: PostPayload,
    accessToken: string,
    pageId?: string
  ): Promise<PostResult> {
    const targetId = pageId ?? 'me'
    const body: Record<string, string> = {
      message: payload.content,
      access_token: accessToken,
    }

    if (payload.mediaUrls?.length) {
      body.link = payload.mediaUrls[0]
    }

    const { ok, data } = await this.fetchJson<{ id?: string; error?: { message: string } }>(
      `https://graph.facebook.com/v19.0/${targetId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!ok || !data.id) {
      return { success: false, error: data.error?.message ?? 'Facebook post failed' }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id.replace('_', '/posts/')}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: { message: string }
    }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${refreshToken}`,
      { method: 'GET' }
    )

    if (!ok || !data.access_token) {
      throw new Error(data.error?.message ?? 'Facebook token refresh failed')
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
      comments?: { summary: { total_count: number } }
      shares?: { count: number }
    }>(
      `https://graph.facebook.com/v19.0/${platformPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`,
      {}
    )

    if (!ok) return {}
    return {
      likes: data.likes?.summary?.total_count,
      comments: data.comments?.summary?.total_count,
      shares: data.shares?.count,
    }
  }
}
