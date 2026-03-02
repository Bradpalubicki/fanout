import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class LinkedInDistributor extends BaseDistributor {
  platform = 'linkedin'

  async post(payload: PostPayload, accessToken: string): Promise<PostResult> {
    // Get user URN first
    const { ok: meOk, data: meData } = await this.fetchJson<{
      sub?: string
      id?: string
    }>('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!meOk || !meData.sub) {
      return { success: false, error: 'Failed to get LinkedIn user ID' }
    }

    const authorUrn = `urn:li:person:${meData.sub}`

    const shareBody: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: payload.content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const { ok, data } = await this.fetchJson<{ id?: string; message?: string }>(
      'https://api.linkedin.com/v2/ugcPosts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(shareBody),
      }
    )

    if (!ok || !data.id) {
      return { success: false, error: data.message ?? 'LinkedIn post failed' }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: `https://www.linkedin.com/feed/update/${data.id}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      refresh_token?: string
      expires_in?: number
      error?: string
    }>('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }).toString(),
    })

    if (!ok || !data.access_token) {
      throw new Error(data.error ?? 'LinkedIn token refresh failed')
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 5183944) * 1000),
    }
  }

  async getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    const encoded = encodeURIComponent(platformPostId)
    const { ok, data } = await this.fetchJson<{
      elements?: { totalShareStatistics?: { likeCount: number; commentCount: number; shareCount: number; impressionCount: number } }[]
    }>(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encoded}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!ok || !data.elements?.[0]?.totalShareStatistics) return {}
    const s = data.elements[0].totalShareStatistics
    return {
      likes: s.likeCount,
      comments: s.commentCount,
      shares: s.shareCount,
      impressions: s.impressionCount,
    }
  }
}
