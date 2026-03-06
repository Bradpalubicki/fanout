import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

// Mastodon uses instance-specific REST API
// access_token = OAuth2 token
// platform_config (stored in oauth_tokens) should include instance_url

export class MastodonDistributor extends BaseDistributor {
  platform = 'mastodon'

  async post(payload: PostPayload, accessToken: string, pageId?: string): Promise<PostResult> {
    // pageId is repurposed to carry instance_url for Mastodon
    const instanceUrl = pageId ?? 'https://mastodon.social'
    const text = payload.content.slice(0, 500)

    const { ok, data } = await this.fetchJson<{
      id?: string
      url?: string
      error?: string
    }>(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: text,
        visibility: 'public',
      }),
    })

    if (!ok || !data.id) {
      return { success: false, error: (data as { error?: string }).error ?? 'Mastodon post failed' }
    }

    return {
      success: true,
      platformPostId: data.id,
      platformPostUrl: data.url ?? `${instanceUrl}/@me/${data.id}`,
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    // Mastodon OAuth tokens typically don't expire — stub
    throw new Error('Mastodon token refresh not implemented')
  }

  async getAnalytics(_platformPostId: string, _accessToken: string): Promise<Partial<AnalyticsSnapshot>> {
    return {}
  }
}
