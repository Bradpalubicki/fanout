import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class YouTubeDistributor extends BaseDistributor {
  platform = 'youtube'

  async post(payload: PostPayload, accessToken: string, _pageId?: string): Promise<PostResult> {
    // YouTube community posts use the Google YouTube Data API v3 posts endpoint
    // Requires the channel to have community posts enabled (1000+ subscribers or YPP)
    const { ok, data } = await this.fetchJson<{
      id?: string
      error?: { message: string; code?: number }
    }>(
      'https://www.googleapis.com/youtube/v3/posts?part=id,snippet',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            text: payload.content.slice(0, 5000),
          },
        }),
      }
    )

    if (!ok || !data.id) {
      return {
        success: false,
        error: data.error?.message ?? 'YouTube community post failed — channel may require 1000+ subscribers',
      }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.youtube.com/post/${data.id}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: string
    }>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      }).toString(),
    })

    if (!ok || !data.access_token) {
      throw new Error(data.error ?? 'YouTube token refresh failed')
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    }
  }

  async getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    const { ok, data } = await this.fetchJson<{
      items?: {
        statistics?: {
          viewCount: string
          likeCount: string
          commentCount: string
        }
      }[]
    }>(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${platformPostId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!ok || !data.items?.[0]?.statistics) return {}
    const s = data.items[0].statistics
    return {
      impressions: parseInt(s.viewCount ?? '0'),
      likes: parseInt(s.likeCount ?? '0'),
      comments: parseInt(s.commentCount ?? '0'),
    }
  }
}
