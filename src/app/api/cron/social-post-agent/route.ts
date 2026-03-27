export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { BlueskyDistributor } from '@/distributors/bluesky'
import { MastodonDistributor } from '@/distributors/mastodon'
import { TwitterDistributor } from '@/distributors/twitter'
import { LinkedInDistributor } from '@/distributors/linkedin'
import { RedditDistributor } from '@/distributors/reddit'
import { InstagramDistributor } from '@/distributors/instagram'
import { TikTokDistributor } from '@/distributors/tiktok'
import { FacebookDistributor } from '@/distributors/facebook'
import { ThreadsDistributor } from '@/distributors/threads'
import { YouTubeDistributor } from '@/distributors/youtube'
import { PinterestDistributor } from '@/distributors/pinterest'
import type { BaseDistributor } from '@/distributors/base'
import { PLATFORM_RATE_LIMITS } from '@/lib/product-platforms'

// Map platform names to distributor instances
const DISTRIBUTORS: Record<string, BaseDistributor> = {
  bluesky: new BlueskyDistributor(),
  mastodon: new MastodonDistributor(),
  twitter: new TwitterDistributor(),
  linkedin: new LinkedInDistributor(),
  reddit: new RedditDistributor(),
  instagram: new InstagramDistributor(),
  tiktok: new TikTokDistributor(),
  facebook: new FacebookDistributor(),
  threads: new ThreadsDistributor(),
  youtube: new YouTubeDistributor(),
  pinterest: new PinterestDistributor(),
}

interface QueuedPost {
  id: string
  product: string
  platform: string
  content: string
  image_url: string | null
  scheduled_for: string | null
}

interface ProductAccount {
  product: string
  platform: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  platform_user_id: string | null
  extra_config: Record<string, unknown> | null
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // Fetch due pending posts
  const { data: posts, error: fetchError } = await supabase
    .from('social_posts_queue')
    .select('id, product, platform, content, image_url, scheduled_for')
    .eq('status', 'pending')
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .limit(50)

  if (fetchError) {
    console.error('[social-post-agent] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!posts?.length) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  // Mark all as 'posting' to prevent double-processing
  const postIds = posts.map((p: QueuedPost) => p.id)
  await supabase
    .from('social_posts_queue')
    .update({ status: 'posting' })
    .in('id', postIds)

  const results: Array<{ id: string; product: string; platform: string; result: string; error?: string }> = []

  // Track posts per platform this run (rate limiting)
  const platformPostCount: Record<string, number> = {}

  for (const post of posts as QueuedPost[]) {
    const { id, product, platform, content, image_url } = post

    // Rate limit check
    const rateLimit = PLATFORM_RATE_LIMITS[platform] ?? 5
    const currentCount = platformPostCount[platform] ?? 0
    if (currentCount >= rateLimit) {
      const err = `Rate limit reached for ${platform} this window (max ${rateLimit}/6hr) — will retry next run`
      console.log(`[social-post-agent] rate limit: ${err}`)
      await supabase
        .from('social_posts_queue')
        .update({ status: 'pending' })
        .eq('id', id)
      results.push({ id, product, platform, result: 'skipped', error: err })
      continue
    }

    // Look up the account credentials for this product+platform
    const { data: accountRow, error: accountError } = await supabase
      .from('product_platform_accounts')
      .select('access_token, refresh_token, expires_at, platform_user_id, extra_config')
      .eq('product', product)
      .eq('platform', platform)
      .eq('status', 'active')
      .single()

    if (accountError || !accountRow) {
      const err = `No active account for ${product}/${platform} — connect via Fanout dashboard first`
      console.error(`[social-post-agent] ${id}: ${err}`)
      await supabase
        .from('social_posts_queue')
        .update({ status: 'failed', error_text: err })
        .eq('id', id)
      results.push({ id, product, platform, result: 'failed', error: err })
      continue
    }

    const account = accountRow as ProductAccount

    // Check if token is expired and refresh if possible
    let accessToken = account.access_token
    if (account.expires_at && new Date(account.expires_at) <= new Date()) {
      const distributor = DISTRIBUTORS[platform]
      if (distributor && account.refresh_token) {
        try {
          const refreshed = await distributor.refreshToken(account.refresh_token)
          accessToken = refreshed.accessToken
          // Persist refreshed token
          await supabase
            .from('product_platform_accounts')
            .update({
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken ?? account.refresh_token,
              expires_at: refreshed.expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('product', product)
            .eq('platform', platform)
          console.log(`[social-post-agent] refreshed token for ${product}/${platform}`)
        } catch (refreshErr) {
          const err = `Token expired and refresh failed: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`
          console.error(`[social-post-agent] ${id}: ${err}`)
          await supabase
            .from('product_platform_accounts')
            .update({ status: 'expired' })
            .eq('product', product)
            .eq('platform', platform)
          await supabase
            .from('social_posts_queue')
            .update({ status: 'failed', error_text: err })
            .eq('id', id)
          results.push({ id, product, platform, result: 'failed', error: err })
          continue
        }
      } else {
        const err = `Token expired for ${product}/${platform} — no refresh token available`
        console.error(`[social-post-agent] ${id}: ${err}`)
        await supabase
          .from('product_platform_accounts')
          .update({ status: 'expired' })
          .eq('product', product)
          .eq('platform', platform)
        await supabase
          .from('social_posts_queue')
          .update({ status: 'failed', error_text: err })
          .eq('id', id)
        results.push({ id, product, platform, result: 'failed', error: err })
        continue
      }
    }

    const distributor = DISTRIBUTORS[platform]
    if (!distributor) {
      const err = `No distributor found for platform: ${platform}`
      console.error(`[social-post-agent] ${id}: ${err}`)
      await supabase
        .from('social_posts_queue')
        .update({ status: 'failed', error_text: err })
        .eq('id', id)
      results.push({ id, product, platform, result: 'failed', error: err })
      continue
    }

    // Build payload
    const payload = {
      content,
      mediaUrls: image_url ? [image_url] : undefined,
      platformConfig: account.extra_config ?? {},
    }

    // pageId carries platform-specific IDs (ig user id, mastodon instance, etc.)
    const pageId = account.platform_user_id ??
      (account.extra_config?.instance_url as string | undefined)

    try {
      const postResult = await distributor.post(payload, accessToken, pageId)

      if (postResult.success) {
        await supabase
          .from('social_posts_queue')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            platform_post_id: postResult.platformPostId ?? null,
            platform_post_url: postResult.platformPostUrl ?? null,
            error_text: null,
          })
          .eq('id', id)

        // Update last_used_at on the account
        await supabase
          .from('product_platform_accounts')
          .update({ last_used_at: new Date().toISOString() })
          .eq('product', product)
          .eq('platform', platform)

        results.push({ id, product, platform, result: 'posted' })
        platformPostCount[platform] = (platformPostCount[platform] ?? 0) + 1
        console.log(`[social-post-agent] ✓ ${product}/${platform}: ${postResult.platformPostUrl}`)
      } else {
        const err = postResult.error ?? 'Unknown error'
        console.error(`[social-post-agent] ✗ ${product}/${platform}: ${err}`)
        await supabase
          .from('social_posts_queue')
          .update({ status: 'failed', error_text: err })
          .eq('id', id)
        results.push({ id, product, platform, result: 'failed', error: err })
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      console.error(`[social-post-agent] exception ${product}/${platform}: ${err}`)
      await supabase
        .from('social_posts_queue')
        .update({ status: 'failed', error_text: err })
        .eq('id', id)
      results.push({ id, product, platform, result: 'failed', error: err })
    }
  }

  const posted = results.filter((r) => r.result === 'posted').length
  const failed = results.filter((r) => r.result === 'failed').length

  return NextResponse.json({
    processed: results.length,
    posted,
    failed,
    results,
  })
}
