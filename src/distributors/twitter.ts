import {
  BaseDistributor,
  type ListPostsOptions,
  type ListPostsResult,
  type NativePost,
  type PostPayload,
  type PostResult,
  type RefreshResult,
} from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

interface Tweet {
  id: string
  text?: string
  created_at?: string
  public_metrics?: {
    impression_count?: number
    like_count?: number
    reply_count?: number
    retweet_count?: number
  }
}

export class TwitterDistributor extends BaseDistributor {
  platform = 'twitter'

  /**
   * Native history via /2/users/{id}/tweets — the account's OWN tweets.
   * Deliberately NOT the /mentions endpoint collect-inbox.ts uses: mentions are
   * what others wrote about the account, which is the opposite of history.
   * Covered by tweet.read, which we already request.
   *
   * Resolves the user id itself when not supplied, so a caller holding only a
   * token still works. Twitter uses pagination_token, not a Graph cursor.
   */
  async listPosts(
    accessToken: string,
    options?: ListPostsOptions,
    accountId?: string
  ): Promise<ListPostsResult> {
    const auth = { Authorization: `Bearer ${accessToken}` }

    let userId = accountId
    if (!userId) {
      const me = await this.fetchJson<{ data?: { id?: string } }>(
        'https://api.twitter.com/2/users/me',
        { method: 'GET', headers: auth }
      )
      if (!me.ok || !me.data.data?.id) {
        throw new Error(`Twitter user lookup failed (${me.status})`)
      }
      userId = me.data.data.id
    }

    // API minimum is 5, maximum 100. A value outside it 400s rather than clamping.
    const limit = Math.min(Math.max(options?.limit ?? 25, 5), 100)
    const params = new URLSearchParams({
      max_results: String(limit),
      'tweet.fields': 'created_at,public_metrics',
    })
    if (options?.cursor) params.set('pagination_token', options.cursor)

    const { ok, data, status } = await this.fetchJson<{
      data?: Tweet[]
      meta?: { next_token?: string }
    }>(`https://api.twitter.com/2/users/${userId}/tweets?${params}`, {
      method: 'GET',
      headers: auth,
    })

    if (!ok) {
      throw new Error(`Twitter timeline read failed (${status})`)
    }

    const posts: NativePost[] = (data.data ?? []).map((t) => ({
      platformPostId: t.id,
      platformPostUrl: `https://twitter.com/i/web/status/${t.id}`,
      content: t.text,
      publishedAt: t.created_at ? new Date(t.created_at) : undefined,
      metrics: {
        impressions: t.public_metrics?.impression_count ?? 0,
        likes: t.public_metrics?.like_count ?? 0,
        comments: t.public_metrics?.reply_count ?? 0,
        shares: t.public_metrics?.retweet_count ?? 0,
      },
    }))

    // meta.next_token is absent on the final page.
    return { posts, nextCursor: data.meta?.next_token }
  }

  async post(payload: PostPayload, accessToken: string, _pageId?: string): Promise<PostResult> {
    const body: Record<string, unknown> = { text: payload.content }

    const { ok, data } = await this.fetchJson<{
      data?: { id: string; text: string }
      errors?: { message: string }[]
    }>('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!ok || !data.data?.id) {
      return {
        success: false,
        error: data.errors?.[0]?.message ?? 'Twitter post failed',
      }
    }

    return {
      success: true,
      platformPostId: data.data.id,
      platformPostUrl: `https://twitter.com/i/web/status/${data.data.id}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.TWITTER_CLIENT_ID!,
    })

    const credentials = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString('base64')

    const { ok, data } = await this.fetchJson<{
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
    }>('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: params.toString(),
    })

    if (!ok || !data.access_token) {
      throw new Error(data.error ?? 'Twitter token refresh failed')
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 7200) * 1000),
    }
  }

  async getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    const { ok, data } = await this.fetchJson<{
      data?: {
        public_metrics?: {
          like_count: number
          reply_count: number
          retweet_count: number
          impression_count: number
        }
      }
    }>(
      `https://api.twitter.com/2/tweets/${platformPostId}?tweet.fields=public_metrics`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!ok || !data.data?.public_metrics) return {}

    const m = data.data.public_metrics
    return {
      likes: m.like_count,
      comments: m.reply_count,
      shares: m.retweet_count,
      impressions: m.impression_count,
    }
  }
}
