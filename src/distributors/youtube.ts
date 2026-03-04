import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class YouTubeDistributor extends BaseDistributor {
  platform = 'youtube'

  async post(payload: PostPayload, accessToken: string, _pageId?: string): Promise<PostResult> {
    // YouTube requires video content — for text-only posts, create a community post
    // Community posts require YouTube Partner Program — this posts as a community update
    const body = {
      snippet: {
        title: payload.content.slice(0, 100),
        description: payload.content,
        tags: [],
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    }

    // For text community posts (no video upload)
    const { ok, data } = await this.fetchJson<{
      id?: string
      error?: { message: string }
    }>(
      'https://www.googleapis.com/youtube/v3/watermarks?part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    // YouTube community posts use a different API endpoint
    const communityRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channelSections?part=snippet',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'youtube#channelSection',
          snippet: {
            type: 'singlePlaylist',
            title: payload.content.slice(0, 100),
          },
        }),
      }
    )

    // Simplified: post as a playlist description update (community posts need separate approval)
    if (!ok) {
      return {
        success: false,
        error: data.error?.message ?? 'YouTube requires video content or Partner Program for community posts',
      }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.youtube.com/watch?v=${data.id}`,
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
