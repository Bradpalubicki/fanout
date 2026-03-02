import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class TwitterDistributor extends BaseDistributor {
  platform = 'twitter'

  async post(payload: PostPayload, accessToken: string): Promise<PostResult> {
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
