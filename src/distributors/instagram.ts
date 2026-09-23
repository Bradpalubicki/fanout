import {
  BaseDistributor,
  NativeHistoryUnsupportedError,
  type ListPostsOptions,
  type ListPostsResult,
  type NativePost,
  type PostPayload,
  type PostResult,
  type RefreshResult,
} from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

interface IgMedia {
  id: string
  caption?: string
  timestamp?: string
  permalink?: string
  media_url?: string
  thumbnail_url?: string
  like_count?: number
  comments_count?: number
}

export class InstagramDistributor extends BaseDistributor {
  platform = 'instagram'

  /**
   * Native history via /media — the account's own posts. Instagram has no
   * /feed: that is a Facebook Page concept. Covered by instagram_basic, and
   * collect-inbox.ts already reads this endpoint in production.
   */
  async listPosts(
    accessToken: string,
    options?: ListPostsOptions,
    accountId?: string
  ): Promise<ListPostsResult> {
    if (!accountId) {
      throw new NativeHistoryUnsupportedError(
        this.platform,
        'an IG user id is required; there is no "me" equivalent for Business accounts'
      )
    }

    const limit = Math.min(options?.limit ?? 25, 100)
    const params = new URLSearchParams({
      fields: 'id,caption,timestamp,permalink,media_url,thumbnail_url,like_count,comments_count',
      limit: String(limit),
      access_token: accessToken,
    })
    if (options?.cursor) params.set('after', options.cursor)

    const { ok, data, status } = await this.fetchJson<{
      data?: IgMedia[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(`https://graph.facebook.com/v19.0/${accountId}/media?${params}`, { method: 'GET' })

    if (!ok) {
      throw new Error(`Instagram media read failed (${status})`)
    }

    const posts: NativePost[] = (data.data ?? []).map((m) => ({
      platformPostId: m.id,
      platformPostUrl: m.permalink ?? `https://www.instagram.com/p/${m.id}/`,
      content: m.caption,
      // thumbnail_url is only present for video; media_url covers images.
      mediaUrls: [m.media_url, m.thumbnail_url].filter((u): u is string => !!u),
      publishedAt: m.timestamp ? new Date(m.timestamp) : undefined,
      // Cumulative counters. Stored as-is and never summed across syncs.
      metrics: {
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
      },
    }))

    const nextCursor = data.paging?.next ? data.paging?.cursors?.after : undefined

    return { posts, nextCursor }
  }

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
    // Instagram Business tokens are long-lived (60 days) and refreshed via Graph API
    // graph.instagram.com is the deprecated Basic Display API — use graph.facebook.com instead
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: { message: string }
    }>(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`,
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
