import { supabase } from './supabase'
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
import type { BaseDistributor } from '@/distributors/base'
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
}

export { DISTRIBUTORS }

interface FanOutResult {
  platform: string
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  error?: string
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
        return {
          platform,
          success: false,
          error: `No OAuth token found for ${platform}`,
        }
      }

      const distributor = DISTRIBUTORS[platform]
      if (!distributor) {
        return {
          platform,
          success: false,
          error: `Platform ${platform} not supported`,
        }
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
        await supabase.from('post_results').upsert({
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
        const error = err instanceof Error ? err.message : 'Unknown error'
        await supabase.from('post_results').upsert({
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
