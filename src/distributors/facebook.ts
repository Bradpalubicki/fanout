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

interface GraphFeedPost {
  id: string
  message?: string
  created_time?: string
  permalink_url?: string
  full_picture?: string
}

export class FacebookDistributor extends BaseDistributor {
  platform = 'facebook'

  /**
   * Native history via the Page feed. Covered by pages_read_engagement, which
   * we already request — collect-inbox.ts has read this same endpoint in
   * production, so the read path is proven; only retention was missing.
   *
   * Requires a Page id: 'me' resolves to the USER, whose feed is a different
   * (and for a business profile, empty) thing. Failing loudly beats silently
   * backfilling zero posts and marking the account complete.
   */
  async listPosts(
    accessToken: string,
    options?: ListPostsOptions,
    accountId?: string
  ): Promise<ListPostsResult> {
    if (!accountId) {
      throw new NativeHistoryUnsupportedError(
        this.platform,
        'a Page id is required — the user feed is not the Page feed'
      )
    }

    const limit = Math.min(options?.limit ?? 25, 100)
    const params = new URLSearchParams({
      fields: 'id,message,created_time,permalink_url,full_picture',
      limit: String(limit),
      access_token: accessToken,
    })
    // Graph cursor pagination. Persisted verbatim; never parsed.
    if (options?.cursor) params.set('after', options.cursor)

    const { ok, data, status } = await this.fetchJson<{
      data?: GraphFeedPost[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(`https://graph.facebook.com/v19.0/${accountId}/feed?${params}`, { method: 'GET' })

    if (!ok) {
      throw new Error(`Facebook feed read failed (${status})`)
    }

    const posts: NativePost[] = (data.data ?? []).map((p) => ({
      platformPostId: p.id,
      platformPostUrl: p.permalink_url ?? `https://www.facebook.com/${p.id.replace('_', '/posts/')}`,
      content: p.message,
      mediaUrls: p.full_picture ? [p.full_picture] : undefined,
      publishedAt: p.created_time ? new Date(p.created_time) : undefined,
    }))

    // `next` absent means the last page. Returning a cursor without it would
    // loop the backfill forever on the final page.
    const nextCursor = data.paging?.next ? data.paging?.cursors?.after : undefined

    return { posts, nextCursor }
  }

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
