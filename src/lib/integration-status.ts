// Integration status for social platforms.
//
// HISTORY — why this file was rewritten (2026-09-23):
// The previous version claimed in its own header to "attempt a read call to
// verify each platform". It made ZERO network calls and held six hardcoded
// status literals. Bluesky and Mastodon were hardcoded to WORKING with no check
// of any kind. Two planning documents (the CFC competitive audit and the
// Ayrshare parity strategy) drew the conclusion "0 of 9 platforms post in
// production, only Bluesky and Mastodon work" directly from that output.
//
// Both halves were wrong. Nothing had been proven broken — nobody had connected
// an account (oauth_tokens = 0). And nothing had been proven working either:
// product_platform_accounts was also 0, so Bluesky/Mastodon had no stored
// credentials to post with.
//
// THE RULE THIS FILE NOW FOLLOWS:
// Never report a capability we have not observed. The only honest evidence that
// a platform posts is a post_results row carrying a real platform_post_id.
// Credentials existing is not evidence of working — that is the
// presence-is-not-validity failure. Absence of a token is not evidence of
// broken either; it usually just means nobody has connected yet.

import { getSupabase } from './supabase'

/**
 * Deliberately distinguishes "we have never tried" from "we tried and it
 * failed". The old type could not express that difference, which is what let
 * NEVER_SETUP and BROKEN both read as "does not work".
 */
export type IntegrationStatus =
  /** A post succeeded and returned a real platform post id. The only proof. */
  | 'VERIFIED'
  /** A credential is stored, but no post has ever succeeded. Unproven. */
  | 'CONNECTED_UNPROVEN'
  /** App credentials configured, but no account connected. Expected pre-launch. */
  | 'AWAITING_CONNECTION'
  /** No app credentials in this environment. Nothing has been attempted. */
  | 'NOT_CONFIGURED'
  /** A post was attempted and failed. The only status that means "broken". */
  | 'FAILING'

export interface IntegrationCheck {
  platform: string
  status: IntegrationStatus
  /** What was actually observed, not what we assume it implies. */
  evidence: string
  credentialsPresent: boolean
  tokensStored: number
  successfulPosts: number
  failedPosts: number
  /** External gate a human must clear. Null when the next step is ours. */
  externalBlocker: string | null
}

interface PlatformSpec {
  platform: string
  envKeys: string[]
  /** Known review/verification gate. Stated as a fact about the platform, not
   *  as a claim about our status — these do not change with our data. */
  externalBlocker: string | null
}

const PLATFORMS: PlatformSpec[] = [
  { platform: 'twitter', envKeys: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'], externalBlocker: null },
  { platform: 'linkedin', envKeys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'], externalBlocker: 'w_member_social scope requires LinkedIn review' },
  { platform: 'facebook', envKeys: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'], externalBlocker: 'Meta Business Verification' },
  { platform: 'instagram', envKeys: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'], externalBlocker: 'Meta Business Verification' },
  { platform: 'threads', envKeys: ['THREADS_APP_ID', 'THREADS_APP_SECRET'], externalBlocker: 'Meta Business Verification (shared Meta app)' },
  { platform: 'tiktok', envKeys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'], externalBlocker: 'TikTok Content Posting API review' },
  { platform: 'youtube', envKeys: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'], externalBlocker: 'Google OAuth verification for production' },
  { platform: 'pinterest', envKeys: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'], externalBlocker: 'pins:write requires Pinterest review' },
  { platform: 'reddit', envKeys: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'], externalBlocker: null },
  { platform: 'google_business_profile', envKeys: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'], externalBlocker: 'Google My Business API access approval' },
  // Bluesky and Mastodon need no central OAuth app — credentials are per
  // account. There is no env var to check, so credentialsPresent is decided
  // solely by whether an account is actually stored.
  { platform: 'bluesky', envKeys: [], externalBlocker: null },
  { platform: 'mastodon', envKeys: [], externalBlocker: null },
]

function hasEnvVars(keys: string[]): boolean {
  if (keys.length === 0) return false
  return keys.every((k) => {
    const v = process.env[k]
    return !!v && v.trim() !== '' && v !== 'placeholder'
  })
}

/**
 * Reads observed state from the database. This is the whole point of the file:
 * status is derived from what happened, never from configuration.
 */
export async function getIntegrationAudit(): Promise<IntegrationCheck[]> {
  const supabase = getSupabase()

  const [tokensRes, resultsRes] = await Promise.all([
    supabase.from('oauth_tokens').select('platform'),
    supabase.from('post_results').select('platform, platform_post_id'),
  ])

  const tokensByPlatform = new Map<string, number>()
  for (const row of tokensRes.data ?? []) {
    const p = (row as { platform: string }).platform
    tokensByPlatform.set(p, (tokensByPlatform.get(p) ?? 0) + 1)
  }

  const okByPlatform = new Map<string, number>()
  const failByPlatform = new Map<string, number>()
  for (const row of resultsRes.data ?? []) {
    const r = row as { platform: string; platform_post_id: string | null }
    // A real platform_post_id is the only thing that proves a post landed.
    const target = r.platform_post_id ? okByPlatform : failByPlatform
    target.set(r.platform, (target.get(r.platform) ?? 0) + 1)
  }

  // A read failure must not silently render as "nothing works". Surface it.
  const readFailed = !!tokensRes.error || !!resultsRes.error

  return PLATFORMS.map((spec) => {
    const tokensStored = tokensByPlatform.get(spec.platform) ?? 0
    const successfulPosts = okByPlatform.get(spec.platform) ?? 0
    const failedPosts = failByPlatform.get(spec.platform) ?? 0
    const credentialsPresent = hasEnvVars(spec.envKeys) || tokensStored > 0

    let status: IntegrationStatus
    let evidence: string

    if (readFailed) {
      status = 'NOT_CONFIGURED'
      evidence = 'Could not read post history — status unknown, not measured.'
    } else if (successfulPosts > 0) {
      status = 'VERIFIED'
      evidence = `${successfulPosts} post(s) returned a real platform post id.`
    } else if (failedPosts > 0) {
      status = 'FAILING'
      evidence = `${failedPosts} post attempt(s), none returned a platform post id.`
    } else if (tokensStored > 0) {
      status = 'CONNECTED_UNPROVEN'
      evidence = `${tokensStored} account(s) connected, but no post has been attempted yet.`
    } else if (credentialsPresent) {
      status = 'AWAITING_CONNECTION'
      evidence = 'App credentials configured; no account has connected yet. Untested, not broken.'
    } else {
      status = 'NOT_CONFIGURED'
      evidence = 'No app credentials in this environment. Nothing attempted.'
    }

    return {
      platform: spec.platform,
      status,
      evidence,
      credentialsPresent,
      tokensStored,
      successfulPosts,
      failedPosts,
      externalBlocker: spec.externalBlocker,
    }
  })
}

/**
 * Platforms proven to post. VERIFIED only — a stored credential is not proof.
 * Safe to drive public "supported platforms" copy from this: it can only ever
 * list a platform after a real post has gone out from production.
 */
export async function getVerifiedPlatforms(): Promise<string[]> {
  const audit = await getIntegrationAudit()
  return audit.filter((c) => c.status === 'VERIFIED').map((c) => c.platform)
}
