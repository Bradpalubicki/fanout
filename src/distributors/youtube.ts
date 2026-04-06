import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class YouTubeDistributor extends BaseDistributor {
  platform = 'youtube'

  async post(_payload: PostPayload, _accessToken: string, _pageId?: string): Promise<PostResult> {
    // YouTube Data API v3 has no endpoint for community posts.
    // The /youtube/v3/posts endpoint does not exist.
    // Video uploads require a different flow (resumable upload API).
    // Mark as unsupported until video upload support is added.
    return {
      success: false,
      error: 'YouTube community posts are not available via API. Video upload support coming soon.',
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
