import type { AnalyticsSnapshot } from '@/lib/types'

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    public readonly platform: string
  ) {
    super(`Rate limited by ${platform} — retry after ${retryAfterSeconds}s`)
    this.name = 'RateLimitError'
  }
}

export interface PostPayload {
  content: string
  mediaUrls?: string[]
  platformConfig?: Record<string, unknown>
}

export interface PostResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  error?: string
}

export interface RefreshResult {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
}

/** One post read back from a provider — possibly created outside Fanout. */
export interface NativePost {
  /** The provider's own id. Half the natural key in external_posts. */
  platformPostId: string
  platformPostUrl?: string
  content?: string
  mediaUrls?: string[]
  /**
   * Provider-reported publish time. NOT discovery time: a backfill imports old
   * posts "now", so ordering history by discovery would scramble it.
   */
  publishedAt?: Date
  /** Cumulative provider counters. Never summed across syncs — they double-count. */
  metrics?: Record<string, number>
}

export interface ListPostsResult {
  posts: NativePost[]
  /**
   * Opaque provider cursor for the next page, or undefined at the end.
   * Deliberately untyped: Graph uses `after`, Twitter `pagination_token`,
   * TikTok a numeric cursor. Callers persist it verbatim in
   * external_post_sync_state.cursor and must not parse it.
   */
  nextCursor?: string
}

export interface ListPostsOptions {
  /** Resume token from a previous page. Omit to start from the newest post. */
  cursor?: string
  /** Provider page size. Capped per platform inside each implementation. */
  limit?: number
}

/**
 * Account-level metrics — properties of the ACCOUNT, not of any post.
 *
 * Deliberately split into two groups, because mixing them is exactly how the
 * double-count bug happens (fixed in mobile/analytics on 2026-09-23):
 *  - CUMULATIVE: running totals. Two readings of 400 then 410 followers mean
 *    the account has 410, never 810. Never sum these across snapshots.
 *  - PERIOD: describe a window, and are not comparable to the cumulative ones.
 */
export interface AccountMetrics {
  /** Cumulative — running totals at the moment of collection. */
  followers?: number
  following?: number
  postsCount?: number
  /** Period — for the window the provider reports, usually the last day. */
  impressions?: number
  reach?: number
  profileViews?: number
  engagements?: number
  /** Platform-specific fields with no column of their own. */
  raw?: Record<string, unknown>
}

/**
 * Thrown when a platform cannot report ACCOUNT-level metrics. Distinct from
 * returning zeros: zero followers is a real answer, "we cannot read this" is
 * not, and a collector must not record the former when it means the latter.
 */
export class AccountMetricsUnsupportedError extends Error {
  constructor(public readonly platform: string, reason: string) {
    super(`${platform} cannot report account metrics: ${reason}`)
    this.name = 'AccountMetricsUnsupportedError'
  }
}

/**
 * Thrown when a platform cannot read an account's own posts at all — the
 * scopes are write-only, or the provider exposes no such endpoint.
 *
 * Distinct from returning an empty list: empty means "read succeeded, nothing
 * there", which is a legitimate answer. A caller that cannot tell those apart
 * would record a completed backfill for an account whose history was never
 * readable, and then never try again.
 */
export class NativeHistoryUnsupportedError extends Error {
  constructor(public readonly platform: string, reason: string) {
    super(`${platform} cannot list account posts: ${reason}`)
    this.name = 'NativeHistoryUnsupportedError'
  }
}

export abstract class BaseDistributor {
  abstract platform: string

  abstract post(payload: PostPayload, accessToken: string, pageId?: string): Promise<PostResult>

  abstract refreshToken(refreshToken: string): Promise<RefreshResult>

  abstract getAnalytics(
    platformPostId: string,
    accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>>

  /**
   * List posts this ACCOUNT published, including ones created outside Fanout.
   * Powers native history (/api/v1/history) and the brand-voice pitch.
   *
   * Concrete rather than abstract on purpose: making it abstract would break all
   * twelve distributors at once and pressure whoever adds a platform into
   * writing a stub that silently returns []. An unimplemented platform must be
   * LOUDLY unsupported, not quietly empty — an empty list is a valid answer
   * ("read fine, no posts"), and conflating the two would mark a backfill
   * complete for an account whose history was never readable.
   *
   * Override only where nativeHistory is true in oauth-config.ts. That flag is
   * about what the granted SCOPES permit; this method is whether we built it.
   */
  async listPosts(
    _accessToken: string,
    _options?: ListPostsOptions,
    _accountId?: string
  ): Promise<ListPostsResult> {
    throw new NativeHistoryUnsupportedError(this.platform, 'listPosts is not implemented')
  }

  /**
   * Account-level metrics: followers, reach, profile views. This is what an
   * agency reports to its client monthly — "is this account growing?" — and it
   * is a different question from per-post performance, which getAnalytics
   * already answers.
   *
   * Concrete, and throws by default, for the same reason as listPosts: a stub
   * returning zeros would be indistinguishable from an account that genuinely
   * has zero followers, and the collector would record that fiction as fact.
   */
  async getAccountMetrics(_accessToken: string, _accountId?: string): Promise<AccountMetrics> {
    throw new AccountMetricsUnsupportedError(
      this.platform,
      'getAccountMetrics is not implemented'
    )
  }

  protected async fetchJson<T>(
    url: string,
    options: RequestInit
  ): Promise<{ ok: boolean; data: T; status: number }> {
    const res = await fetch(url, options)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      throw new RateLimitError(isNaN(retryAfter) ? 60 : retryAfter, this.platform)
    }
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data: data as T, status: res.status }
  }
}
