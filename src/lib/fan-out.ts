import { NonRetriableError } from 'inngest'
import { supabase } from './supabase'

/**
 * Write a post_results row, surfacing a failed write instead of discarding it.
 *
 * These upserts are bookkeeping inside the delivery path, so they must NOT throw:
 * a thrown bookkeeping error would mask the real publish outcome. But a silently
 * dropped write is how a published post ends up with no result row — the UI shows
 * nothing and the retry cron has nothing to find, which is the same class of
 * invisible failure this file already fixed once for the missing-token path.
 */
async function writePostResult(
  row: Record<string, unknown> | Record<string, unknown>[]
): Promise<void> {
  const { error } = await supabase
    .from('post_results')
    .upsert(row as never, { onConflict: 'post_id,platform' })
  if (error) {
    console.error(
      '[fan-out] post_results write FAILED — delivery record lost:',
      error.message,
      JSON.stringify(row)
    )
  }
}
import { decryptToken } from './crypto'
import { TwitterDistributor } from '@/distributors/twitter'
import { LinkedInDistributor } from '@/distributors/linkedin'
import { FacebookDistributor } from '@/distributors/facebook'
import { InstagramDistributor } from '@/distributors/instagram'
import { TikTokDistributor } from '@/distributors/tiktok'
import { PinterestDistributor } from '@/distributors/pinterest'
import { YouTubeDistributor } from '@/distributors/youtube'
import { RedditDistributor } from '@/distributors/reddit'
import { ThreadsDistributor } from '@/distributors/threads'
import { GoogleBusinessProfileDistributor } from '@/distributors/google-business-profile'
import { BlueskyDistributor } from '@/distributors/bluesky'
import { MastodonDistributor } from '@/distributors/mastodon'
import type { BaseDistributor } from '@/distributors/base'
import { RateLimitError } from '@/distributors/base'
import type { Post, OAuthToken } from './types'

const DISTRIBUTORS: Record<string, BaseDistributor> = {
  twitter: new TwitterDistributor(),
  linkedin: new LinkedInDistributor(),
  facebook: new FacebookDistributor(),
  instagram: new InstagramDistributor(),
  tiktok: new TikTokDistributor(),
  pinterest: new PinterestDistributor(),
  youtube: new YouTubeDistributor(),
  reddit: new RedditDistributor(),
  threads: new ThreadsDistributor(),
  google_business_profile: new GoogleBusinessProfileDistributor(),
  bluesky: new BlueskyDistributor(),
  mastodon: new MastodonDistributor(),
}

export { DISTRIBUTORS }

export interface FanOutResult {
  platform: string
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  error?: string
  rateLimited?: boolean
  retryAfterSeconds?: number
}

/**
 * Thrown when the (post, profile, platform) tuple a caller supplied does not
 * match the post row itself. This is a tenant-isolation failure, not a
 * transient error: it means the job would have dispatched one profile's
 * content using another profile's credentials.
 */
export class TupleMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TupleMismatchError'
  }
}

/**
 * The post row is the single authority for who owns a post and where it may go.
 * Callers supply profileId and platforms as event data (fan-out-post.ts:51,
 * scheduled-post.ts:22, retry-post.ts:31); event data is not a credential.
 * Previously the post was read by id while tokens were selected by the
 * separately-supplied profileId, so a mismatched tuple dispatched post B's
 * content on profile A's token — proven by an in-memory probe.
 *
 * This runs before token selection, before the `posting` status write, and
 * before any provider call, notification or webhook, so a rejected job has
 * zero side effects. It lives inside fanOut() rather than in the callers so
 * that scheduled and retried jobs are rechecked at execution time, not only
 * at enqueue time.
 */
function assertTupleMatches(
  post: Pick<Post, 'profile_id' | 'platforms'>,
  postId: string,
  platforms: string[],
  profileId: string
): void {
  if (post.profile_id !== profileId) {
    throw new TupleMismatchError(
      `Post ${postId} belongs to profile ${post.profile_id}, not ${profileId}`
    )
  }

  const allowed = new Set(post.platforms ?? [])
  const disallowed = platforms.filter((p) => !allowed.has(p))
  if (disallowed.length > 0) {
    throw new TupleMismatchError(
      `Post ${postId} was not authored for platform(s) ${disallowed.join(', ')}`
    )
  }
}

/**
 * A tuple mismatch is a permanent isolation failure, not a transient one.
 * Retrying it would only re-attempt the same cross-tenant dispatch, and would
 * bury the cause under a generic retry-exhausted error. Inngest callers wrap
 * their fanOut() call with this so the job fails immediately and by name.
 */
export function rethrowTupleMismatch(err: unknown): never {
  if (err instanceof TupleMismatchError) throw new NonRetriableError(err.message)
  throw err
}

export async function fanOut(
  postId: string,
  platforms: string[],
  profileId: string
): Promise<FanOutResult[]> {
  // Get post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (postError || !post) throw new Error(`Post not found: ${postId}`)

  // Tenant isolation gate. Must stay above the token query and the status
  // write: everything below this line trusts that the tuple is bound.
  assertTupleMatches(post as Post, postId, platforms, profileId)

  // Get encrypted tokens for platforms
  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('profile_id', profileId)
    .in('platform', platforms)

  const tokenMap: Record<string, OAuthToken> = {}
  for (const token of tokens ?? []) {
    tokenMap[token.platform] = token
  }

  // Mark post as posting
  await supabase.from('posts').update({ status: 'posting' }).eq('id', postId)

  // Fan out to all platforms in parallel
  const results = await Promise.allSettled(
    platforms.map(async (platform): Promise<FanOutResult> => {
      const token = tokenMap[platform]
      if (!token) {
        const error = `No OAuth token found for ${platform}`
        // Persist the failure: without this the caller sees a failed result but the post
        // has no post_results row, so the UI shows nothing and retry has nothing to find.
        await writePostResult({
          post_id: postId,
          platform,
          status: 'failed',
          error_message: error,
        })
        return { platform, success: false, error }
      }

      const distributor = DISTRIBUTORS[platform]
      if (!distributor) {
        const error = `Platform ${platform} not supported`
        await writePostResult({
          post_id: postId,
          platform,
          status: 'failed',
          error_message: error,
        })
        return { platform, success: false, error }
      }

      try {
        const accessToken = await decryptToken(token.access_token)
        const platformPageId = (token as OAuthToken & { platform_page_id?: string }).platform_page_id ?? undefined
        const result = await distributor.post(
          {
            content: (post as Post).content,
            mediaUrls: (post as Post).media_urls ?? undefined,
          },
          accessToken,
          platformPageId
        )

        // Save result
        await writePostResult({
          post_id: postId,
          platform,
          status: result.success ? 'success' : 'failed',
          platform_post_id: result.platformPostId,
          platform_post_url: result.platformPostUrl,
          error_message: result.error,
          posted_at: result.success ? new Date().toISOString() : null,
        })

        // Audit log
        await supabase.from('oauth_audit_log').insert({
          profile_id: profileId,
          platform,
          action: 'post',
          success: result.success,
          metadata: { post_id: postId },
        })

        return { platform, ...result }
      } catch (err) {
        if (err instanceof RateLimitError) {
          await writePostResult({
            post_id: postId,
            platform,
            status: 'failed',
            error_message: err.message,
          })
          return {
            platform,
            success: false,
            error: err.message,
            rateLimited: true,
            retryAfterSeconds: err.retryAfterSeconds,
          }
        }
        const error = err instanceof Error ? err.message : 'Unknown error'
        await writePostResult({
          post_id: postId,
          platform,
          status: 'failed',
          error_message: error,
        })
        return { platform, success: false, error }
      }
    })
  )

  const fanOutResults: FanOutResult[] = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { platform: platforms[i], success: false, error: String(r.reason) }
  )

  // A rejected promise never reached the per-platform catch, so it wrote no result row.
  // Persist those too, otherwise a thrown error leaves the post with no record of why.
  const rejected = results
    .map((r, i) => ({ r, platform: platforms[i] }))
    .filter((x) => x.r.status === 'rejected')
  if (rejected.length) {
    await writePostResult(
      rejected.map((x) => ({
        post_id: postId,
        platform: x.platform,
        status: 'failed',
        error_message: String((x.r as PromiseRejectedResult).reason),
      })))
  }

  // Update post status
  const anySuccess = fanOutResults.some((r) => r.success)
  const allFailed = fanOutResults.every((r) => !r.success)
  await supabase
    .from('posts')
    .update({ status: allFailed ? 'failed' : anySuccess ? 'posted' : 'failed' })
    .eq('id', postId)

  // Fire webhook if configured
  const { data: profile } = await supabase
    .from('profiles')
    .select('webhook_url')
    .eq('id', profileId)
    .single()

  if (profile?.webhook_url) {
    const payload = { postId, results: fanOutResults }
    const eventType = fanOutResults.every((r) => !r.success) ? 'post.failed' : 'post.published'
    let responseStatus: number | null = null
    let responseBody: string | null = null
    try {
      const webhookRes = await fetch(profile.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventType, ...payload }),
      })
      responseStatus = webhookRes.status
      responseBody = await webhookRes.text().catch(() => null)
    } catch (err) {
      responseStatus = 0
      responseBody = err instanceof Error ? err.message : 'Network error'
    }

    await supabase.from('webhook_logs').insert({
      profile_id: profileId,
      event_type: eventType,
      payload,
      response_status: responseStatus,
      response_body: responseBody,
      attempts: 1,
    })
  }

  return fanOutResults
}
