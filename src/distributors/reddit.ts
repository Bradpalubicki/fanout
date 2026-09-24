import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

export class RedditDistributor extends BaseDistributor {
  platform = 'reddit'

  /**
   * Upload one image to Reddit's media host and return the asset URL to submit.
   *
   * Three round trips, and there is no shortcut: Reddit will not accept an
   * off-site image URL on submit, so the bytes must physically pass through
   * here. First `media/asset.json` issues a signed S3 lease, then the bytes go
   * to S3 as multipart form-data carrying the exact fields the lease names
   * (they are signature material — omitting one makes S3 reject it), then the
   * resulting asset URL is what `kind: 'image'` submits.
   *
   * Returns null on any failure. The caller FAILS THE POST rather than falling
   * back to text, which is the opposite of the Twitter policy in cf9621f and
   * deliberate: on Twitter the text still stands on its own, but here the image
   * IS the submission — a `kind: 'image'` post degraded to `kind: 'self'` is a
   * different post in a different format, and silently publishing that to a
   * subreddit is worse than telling the user it failed.
   */
  private async uploadMedia(imageUrl: string, accessToken: string): Promise<string | null> {
    try {
      const img = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
      if (!img.ok) return null

      const mimeType = img.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
      const bytes = Buffer.from(await img.arrayBuffer())
      // Reddit rejects images over 20MB at the lease step.
      if (bytes.byteLength > 20 * 1024 * 1024) return null

      const filename = `upload.${mimeType.split('/')[1] ?? 'jpg'}`

      // Step 1: ask for a signed upload lease.
      const { ok: leaseOk, data: lease } = await this.fetchJson<{
        args?: { action?: string; fields?: { name: string; value: string }[] }
      }>('https://oauth.reddit.com/api/media/asset.json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Fanout/1.0',
        },
        body: new URLSearchParams({ filepath: filename, mimetype: mimeType }).toString(),
      })

      const action = lease.args?.action
      const fields = lease.args?.fields
      if (!leaseOk || !action || !fields?.length) return null

      // Step 2: the bytes. Every lease field is signature material — pass them
      // verbatim, in the order given, with the file last, or S3 returns 403.
      const form = new FormData()
      for (const f of fields) form.append(f.name, f.value)
      form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), filename)

      // Leases come back protocol-relative ("//reddit-uploaded-media.s3...").
      const uploadUrl = action.startsWith('//') ? `https:${action}` : action
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60000),
      })
      if (!uploadRes.ok) return null

      // The submittable asset URL is the upload host plus the key S3 filed it under.
      const key = fields.find((f) => f.name === 'key')?.value
      if (!key) return null
      return `${uploadUrl.replace(/\/$/, '')}/${key}`
    } catch {
      return null
    }
  }

  async post(
    payload: PostPayload,
    accessToken: string,
    subreddit?: string
  ): Promise<PostResult> {
    const configSubreddit = payload.platformConfig?.subreddit as string | undefined
    const targetSubreddit = (subreddit && subreddit.trim()) ? subreddit.trim() : (configSubreddit ?? 'test')

    /**
     * Media was previously DISCARDED here without a word: payload.mediaUrls was
     * never read, so a user attached an image, saw "posted", and the image was
     * silently gone. Found 2026-09-24 — same defect class as Twitter (cf9621f).
     *
     * Reddit takes ONE image per submission — /api/submit has no multi-image
     * field — so any extra urls are ignored rather than silently merged.
     */
    const submitFields: Record<string, string> = {
      kind: 'self',
      sr: targetSubreddit,
      title: payload.content.slice(0, 300),
      text: payload.content,
      nsfw: 'false',
      spoiler: 'false',
    }

    if (payload.mediaUrls?.length) {
      const assetUrl = await this.uploadMedia(payload.mediaUrls[0], accessToken)
      if (!assetUrl) {
        // FAIL LOUDLY — see uploadMedia. Posting the text and dropping the
        // image would publish a different kind of post than the user asked for.
        return {
          success: false,
          error: 'Reddit image upload failed — post not submitted',
        }
      }
      submitFields.kind = 'image'
      submitFields.url = assetUrl
      delete submitFields.text
    }

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
      body: new URLSearchParams(submitFields).toString(),
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
