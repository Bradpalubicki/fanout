import {
  BaseDistributor,
  AccountMetricsUnsupportedError,
  NativeHistoryUnsupportedError,
  type AccountMetrics,
  type ListPostsOptions,
  type ListPostsResult,
  type NativePost,
  type PostPayload,
  type PostResult,
  type RefreshResult,
} from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

/** Shape verified against the live API on 2026-09-23, not inferred from docs. */
interface AuthorFeedItem {
  post?: {
    uri?: string
    author?: { handle?: string }
    record?: { text?: string; createdAt?: string }
    embed?: { images?: Array<{ fullsize?: string; thumb?: string }> }
    likeCount?: number
    replyCount?: number
    repostCount?: number
    quoteCount?: number
  }
  /** Present when the item is a repost/reply rather than an original post. */
  reason?: { $type?: string }
}

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

  /**
   * Native history via app.bsky.feed.getAuthorFeed.
   *
   * Uses the PUBLIC appview host, which needs no authentication at all — unlike
   * every other platform, no token, scope or app review is involved. That makes
   * Bluesky the cheapest end-to-end proof that the native-history chain works.
   *
   * accountId may be a handle or a DID; both are valid `actor` values. Falls
   * back to the identifier in the stored credentials so a caller holding only a
   * token still works.
   */
  async listPosts(
    accessToken: string,
    options?: ListPostsOptions,
    accountId?: string
  ): Promise<ListPostsResult> {
    let actor = accountId
    if (!actor) {
      try {
        const creds = JSON.parse(accessToken) as { identifier?: string }
        actor = creds.identifier
      } catch {
        // Fall through to the explicit error below rather than sending
        // "undefined" as an actor and getting a confusing 400.
      }
    }
    if (!actor) {
      throw new NativeHistoryUnsupportedError(
        this.platform,
        'no handle or DID available — pass an accountId or store credentials as {identifier,password}'
      )
    }

    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100)
    const params = new URLSearchParams({ actor, limit: String(limit) })
    if (options?.cursor) params.set('cursor', options.cursor)

    const { ok, data, status } = await this.fetchJson<{
      feed?: AuthorFeedItem[]
      cursor?: string
    }>(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?${params}`, {
      method: 'GET',
    })

    if (!ok) {
      throw new Error(`Bluesky author feed read failed (${status})`)
    }

    const posts: NativePost[] = []
    for (const item of data.feed ?? []) {
      // `reason` marks a repost of someone else's post. Including it would put
      // another account's words into this client's brand-voice history.
      if (item.reason) continue
      const p = item.post
      if (!p?.uri) continue

      // at://did:plc:xxx/app.bsky.feed.post/RKEY -> the web URL needs the rkey.
      const rkey = p.uri.split('/').pop()
      const handle = p.author?.handle

      posts.push({
        platformPostId: p.uri,
        platformPostUrl:
          handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : undefined,
        content: p.record?.text,
        mediaUrls: (p.embed?.images ?? [])
          .map((i) => i.fullsize ?? i.thumb)
          .filter((u): u is string => !!u),
        publishedAt: p.record?.createdAt ? new Date(p.record.createdAt) : undefined,
        // Cumulative counters, stored unsummed.
        metrics: {
          likes: p.likeCount ?? 0,
          comments: p.replyCount ?? 0,
          shares: p.repostCount ?? 0,
          quotes: p.quoteCount ?? 0,
        },
      })
    }

    // An absent cursor means the last page. Returning one regardless would loop
    // the backfill forever on the final page.
    return { posts, nextCursor: data.cursor }
  }

  /**
   * Account metrics via app.bsky.actor.getProfile — public appview, no auth.
   * Field names verified against the live API on 2026-09-23.
   *
   * Bluesky exposes no period metrics (no impressions/reach), so only the
   * cumulative group is populated. Omitting them is correct: a zero would be
   * indistinguishable from a real zero.
   */
  async getAccountMetrics(accessToken: string, accountId?: string): Promise<AccountMetrics> {
    let actor = accountId
    if (!actor) {
      try {
        actor = (JSON.parse(accessToken) as { identifier?: string }).identifier
      } catch {
        // fall through to the explicit error below
      }
    }
    if (!actor) {
      throw new AccountMetricsUnsupportedError(
        this.platform,
        'no handle or DID available — pass an accountId or store {identifier,password}'
      )
    }

    const { ok, data, status } = await this.fetchJson<{
      followersCount?: number
      followsCount?: number
      postsCount?: number
      handle?: string
      displayName?: string
    }>(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`,
      { method: 'GET' }
    )

    if (!ok) {
      throw new Error(`Bluesky profile read failed (${status})`)
    }

    return {
      followers: data.followersCount,
      following: data.followsCount,
      postsCount: data.postsCount,
      raw: { handle: data.handle, displayName: data.displayName },
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
