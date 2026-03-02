import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class TikTokDistributor extends BaseDistributor {
  platform = 'tiktok'

  async post(payload: PostPayload, accessToken: string): Promise<PostResult> {
    if (!payload.mediaUrls?.length) {
      return { success: false, error: 'TikTok requires a video URL' }
    }

    // TikTok requires chunked video upload — initialize upload
    const { ok: initOk, data: initData } = await this.fetchJson<{
      data?: {
        publish_id?: string
        upload_url?: string
      }
      error?: { message: string }
    }>('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: payload.content.slice(0, 150),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: payload.mediaUrls[0],
        },
      }),
    })

    if (!initOk || !initData.data?.publish_id) {
      return {
        success: false,
        error: initData.error?.message ?? 'TikTok upload init failed',
      }
    }

    return {
      success: true,
      platformPostId: initData.data.publish_id,
      platformPostUrl: `https://www.tiktok.com`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      data?: {
        access_token?: string
        refresh_token?: string
        expires_in?: number
      }
      error?: { message: string }
    }>('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    })

    if (!ok || !data.data?.access_token) {
      throw new Error(data.error?.message ?? 'TikTok token refresh failed')
    }

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + (data.data.expires_in ?? 7776000) * 1000),
    }
  }

  async getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    const { ok, data } = await this.fetchJson<{
      data?: {
        videos?: {
          like_count: number
          comment_count: number
          share_count: number
          view_count: number
        }[]
      }
    }>('https://open.tiktokapis.com/v2/video/query/?fields=like_count,comment_count,share_count,view_count', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters: { video_ids: [platformPostId] } }),
    })

    if (!ok || !data.data?.videos?.[0]) return {}
    const v = data.data.videos[0]
    return {
      likes: v.like_count,
      comments: v.comment_count,
      shares: v.share_count,
      impressions: v.view_count,
    }
  }
}
