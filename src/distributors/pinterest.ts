import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class PinterestDistributor extends BaseDistributor {
  platform = 'pinterest'

  async post(payload: PostPayload, accessToken: string, _pageId?: string): Promise<PostResult> {
    // Get user boards to post to first board
    const { ok: boardsOk, data: boardsData } = await this.fetchJson<{
      items?: { id: string; name: string }[]
    }>('https://api.pinterest.com/v5/boards?page_size=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const boardId = boardsData.items?.[0]?.id
    if (!boardsOk || !boardId) {
      return { success: false, error: 'No Pinterest board found' }
    }

    const pinBody: Record<string, unknown> = {
      board_id: boardId,
      title: payload.content.slice(0, 100),
      description: payload.content,
    }

    if (payload.mediaUrls?.[0]) {
      pinBody.media_source = {
        source_type: 'image_url',
        url: payload.mediaUrls[0],
      }
    } else {
      pinBody.media_source = {
        source_type: 'image_url',
        url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800',
      }
    }

    const { ok, data } = await this.fetchJson<{ id?: string; message?: string }>(
      'https://api.pinterest.com/v5/pins',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pinBody),
      }
    )

    if (!ok || !data.id) {
      return { success: false, error: data.message ?? 'Pinterest post failed' }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.pinterest.com/pin/${data.id}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
    }>('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    })

    if (!ok || !data.access_token) {
      throw new Error(data.error ?? 'Pinterest token refresh failed')
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 31536000) * 1000),
    }
  }

  async getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    const { ok, data } = await this.fetchJson<{
      pin_metrics?: {
        lifetime_metrics?: {
          impression: number
          save: number
          pin_click: number
        }
      }
    }>(`https://api.pinterest.com/v5/pins/${platformPostId}?pin_metrics=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!ok || !data.pin_metrics?.lifetime_metrics) return {}
    const m = data.pin_metrics.lifetime_metrics
    return {
      impressions: m.impression,
      shares: m.save,
      clicks: m.pin_click,
    }
  }
}
