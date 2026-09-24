import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

// Mastodon uses instance-specific REST API
// access_token = OAuth2 token
// platform_config (stored in oauth_tokens) should include instance_url

export class MastodonDistributor extends BaseDistributor {
  platform = 'mastodon'

  /**
   * Upload one image to the instance and return its attachment id.
   *
   * v2/media is asynchronous for large files: 202 means "accepted, still
   * processing", and the id is usable on a status right away — the instance
   * holds the status until processing finishes. So 202 is a success here, and
   * treating it as a failure would discard perfectly good uploads.
   *
   * Returns null on any failure so the caller can post the text anyway.
   */
  private async uploadMedia(
    imageUrl: string,
    accessToken: string,
    instanceUrl: string
  ): Promise<string | null> {
    try {
      const img = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
      if (!img.ok) return null

      const mimeType = img.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
      const bytes = Buffer.from(await img.arrayBuffer())
      // Mastodon's default image limit is 16MB; instances may lower it.
      if (bytes.byteLength > 16 * 1024 * 1024) return null

      const form = new FormData()
      form.append(
        'file',
        new Blob([new Uint8Array(bytes)], { type: mimeType }),
        `upload.${mimeType.split('/')[1] ?? 'jpg'}`
      )

      // No Content-Type header: fetch sets the multipart boundary itself.
      const res = await fetch(`${instanceUrl}/api/v2/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) return null

      const data = (await res.json()) as { id?: string }
      return data.id ?? null
    } catch {
      return null
    }
  }

  async post(payload: PostPayload, accessToken: string, pageId?: string): Promise<PostResult> {
    // pageId is repurposed to carry instance_url for Mastodon
    const instanceUrl = pageId ?? 'https://mastodon.social'
    const text = payload.content.slice(0, 500)

    /**
     * Media was previously DISCARDED here without a word: payload.mediaUrls was
     * never read, so a user attached an image, saw "posted", and the image was
     * silently gone. Found 2026-09-24 — same defect class as Twitter (cf9621f),
     * Reddit (6c0472a) and Threads (d46f44a).
     *
     * Mastodon allows up to 4 attachments per status. Uploads run in parallel
     * because each is an independent round trip.
     */
    const statusBody: Record<string, unknown> = {
      status: text,
      visibility: 'public',
    }

    if (payload.mediaUrls?.length) {
      const ids = (
        await Promise.all(
          payload.mediaUrls
            .slice(0, 4)
            .map((url) => this.uploadMedia(url, accessToken, instanceUrl))
        )
      ).filter((id): id is string => !!id)

      if (ids.length) {
        statusBody.media_ids = ids
      }
      // If every upload failed we still post the text, matching Twitter. Unlike
      // Reddit there is no separate media post type here — a status with text is
      // the same kind of object either way, so losing the image degrades the
      // post rather than changing what it is.
    }

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
      body: JSON.stringify(statusBody),
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

  async refreshToken(_refreshToken: string): Promise<RefreshResult> {
    // Mastodon OAuth tokens don't expire — return a no-op success
    // The caller should keep using the existing access token as-is
    return {
      accessToken: _refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    }
  }

  async getAnalytics(_platformPostId: string, _accessToken: string): Promise<Partial<AnalyticsSnapshot>> {
    return {}
  }
}
