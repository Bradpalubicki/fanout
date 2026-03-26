import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class RedditDistributor extends BaseDistributor {
  platform = 'reddit'

  async post(
    payload: PostPayload,
    accessToken: string,
    subreddit?: string
  ): Promise<PostResult> {
    const configSubreddit = payload.platformConfig?.subreddit as string | undefined
    const targetSubreddit = (subreddit && subreddit.trim()) ? subreddit.trim() : (configSubreddit ?? 'test')
    const { ok, data } = await this.fetchJson<{
      json?: {
        data?: { url?: string; id?: string; name?: string }
        errors?: string[][]
      }
    }>('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Fanout/1.0',
      },
      body: new URLSearchParams({
        kind: 'self',
        sr: targetSubreddit,
        title: payload.content.slice(0, 300),
        text: payload.content,
        nsfw: 'false',
        spoiler: 'false',
      }).toString(),
    })

    if (!ok || data.json?.errors?.length) {
      return {
        success: false,
        error: data.json?.errors?.[0]?.[1] ?? 'Reddit post failed',
      }
    }

    const postId = data.json?.data?.id
    return {
      success: true,
      platformPostId: postId,
      platformPostUrl: data.json?.data?.url,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const credentials = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
    ).toString('base64')

    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: string
    }>('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Fanout/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    })

    if (!ok || !data.access_token) {
      throw new Error(data.error ?? 'Reddit token refresh failed')
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
      data?: {
        ups?: number
        num_comments?: number
        score?: number
      }
    }>(`https://oauth.reddit.com/api/info?id=t3_${platformPostId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Fanout/1.0',
      },
    })

    if (!ok || !data.data) return {}
    return {
      likes: data.data.ups,
      comments: data.data.num_comments,
    }
  }
}
