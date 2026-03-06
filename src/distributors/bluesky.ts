import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

// Bluesky uses AT Protocol with app passwords — not OAuth2
// access_token field stores: JSON.stringify({ identifier, password })

interface BlueskySession {
  accessJwt: string
  did: string
}

export class BlueskyDistributor extends BaseDistributor {
  platform = 'bluesky'

  private async createSession(identifier: string, password: string): Promise<BlueskySession | null> {
    const { ok, data } = await this.fetchJson<{
      accessJwt?: string
      did?: string
      error?: string
    }>('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })

    if (!ok || !data.accessJwt || !data.did) return null
    return { accessJwt: data.accessJwt, did: data.did }
  }

  async post(payload: PostPayload, accessToken: string, _pageId?: string): Promise<PostResult> {
    // access_token is JSON: { identifier, password }
    let identifier: string
    let password: string
    try {
      const creds = JSON.parse(accessToken) as { identifier: string; password: string }
      identifier = creds.identifier
      password = creds.password
    } catch {
      return { success: false, error: 'Invalid Bluesky credentials format' }
    }

    const session = await this.createSession(identifier, password)
    if (!session) {
      return { success: false, error: 'Bluesky login failed — check identifier and app password' }
    }

    const text = payload.content.slice(0, 300)

    const postBody: Record<string, unknown> = {
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        langs: ['en'],
      },
    }

    const { ok, data } = await this.fetchJson<{ uri?: string; cid?: string; error?: string }>(
      'https://bsky.social/xrpc/com.atproto.repo.createRecord',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
      }
    )

    if (!ok || !data.uri) {
      return { success: false, error: (data as { error?: string }).error ?? 'Bluesky post failed' }
    }

    return {
      success: true,
      platformPostId: data.uri,
      platformPostUrl: `https://bsky.app/profile/${identifier}`,
    }
  }

  async refreshToken(_refreshToken: string): Promise<RefreshResult> {
    // Bluesky app passwords don't expire — no refresh needed
    throw new Error('Bluesky app passwords do not require refresh')
  }

  async getAnalytics(_platformPostId: string, _accessToken: string): Promise<Partial<AnalyticsSnapshot>> {
    return {}
  }
}
