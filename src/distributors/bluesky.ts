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

  private async uploadBlob(
    session: BlueskySession,
    imageUrl: string
  ): Promise<{ $type: string; ref: { $link: string }; mimeType: string; size: number } | null> {
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) return null
      const buffer = await imgRes.arrayBuffer()
      const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg'

      const uploadRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          'Content-Type': mimeType,
        },
        body: buffer,
      })
      if (!uploadRes.ok) return null
      const uploadData = await uploadRes.json() as { blob?: { ref?: { $link: string }; mimeType?: string; size?: number } }
      if (!uploadData.blob?.ref) return null
      return {
        $type: 'blob',
        ref: uploadData.blob.ref,
        mimeType: uploadData.blob.mimeType ?? mimeType,
        size: uploadData.blob.size ?? buffer.byteLength,
      }
    } catch {
      return null
    }
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

    // Upload images if present
    const imageUrls = (payload.mediaUrls ?? []).filter((u) =>
      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)
    ).slice(0, 4)

    const uploadedBlobs = (
      await Promise.all(imageUrls.map((url) => this.uploadBlob(session, url)))
    ).filter(Boolean)

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    }

    if (uploadedBlobs.length > 0) {
      record.embed = {
        $type: 'app.bsky.embed.images',
        images: uploadedBlobs.map((blob) => ({ image: blob, alt: text.slice(0, 100) })),
      }
    }

    const postBody: Record<string, unknown> = {
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record,
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
