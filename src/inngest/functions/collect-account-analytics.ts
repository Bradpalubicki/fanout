import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import { decryptToken, TokenCorruptError } from '@/lib/crypto'
import { DISTRIBUTORS } from '@/lib/fan-out'
import { AccountMetricsUnsupportedError, type AccountMetrics } from '@/distributors/base'

/**
 * Nightly account-level metrics collection.
 *
 * Answers "is this client growing?" — the question an agency reports monthly.
 * Distinct from collect-analytics, which measures individual POSTS: a client
 * whose followers fell 5% cares about that regardless of how any single post
 * performed.
 *
 * Writes one row per profile+platform+day into account_analytics. Re-running on
 * the same day UPDATES rather than inserting a duplicate, because
 * account_analytics_day is a real UNIQUE constraint (verified contype='u').
 */

export const collectAccountAnalytics = inngest.createFunction(
  { id: 'collect-account-analytics', retries: 2 },
  [
    { event: 'social/account-analytics.collect' },
    // 00:30 UTC — after collect-analytics at 23:00, so the two do not contend
    // for the same provider rate limits.
    { cron: '30 0 * * *' },
  ],
  async ({ step }) => {
    const tokens = await step.run('find-connected-accounts', async () => {
      const { data } = await supabase
        .from('oauth_tokens')
        .select('id, profile_id, platform, access_token, platform_page_id, platform_user_id')
      return data ?? []
    })

    if (!tokens.length) return { collected: 0, skipped: 0, failed: 0 }

    let collected = 0
    let skipped = 0
    let failed = 0

    for (const token of tokens) {
      const distributor = DISTRIBUTORS[token.platform]
      if (!distributor) {
        skipped++
        continue
      }

      // Decrypt OUTSIDE step.run: a step's return value is persisted by Inngest,
      // so returning a plaintext token would write the credential into step
      // state — the defect fixed in 76534f8.
      let accessToken: string
      try {
        accessToken = await decryptToken(token.access_token)
      } catch (err) {
        if (err instanceof TokenCorruptError) {
          // Permanently unusable; retrying can never succeed.
          skipped++
          continue
        }
        // Transient (RPC timeout, 5xx). Rethrow so Inngest retries rather than
        // silently discarding a VALID credential.
        throw err
      }

      const accountId = token.platform_page_id ?? token.platform_user_id ?? undefined

      const outcome = await step.run(`collect-${token.id}`, async () => {
        let metrics: AccountMetrics
        try {
          metrics = await distributor.getAccountMetrics(accessToken, accountId)
        } catch (err) {
          if (err instanceof AccountMetricsUnsupportedError) {
            // A fact about the platform, not a transient failure. Recording a
            // row of zeros here would be worse than recording nothing: it would
            // render as "this account has no followers" on a growth chart.
            return 'unsupported' as const
          }
          throw err
        }

        // Every field undefined means the provider told us nothing. Writing that
        // row would create a false gap in the time series.
        const hasAnyValue = [
          metrics.followers,
          metrics.following,
          metrics.postsCount,
          metrics.impressions,
          metrics.reach,
          metrics.profileViews,
          metrics.engagements,
        ].some((v) => typeof v === 'number')

        if (!hasAnyValue) return 'empty' as const

        const { error } = await supabase.from('account_analytics').upsert(
          {
            profile_id: token.profile_id,
            platform: token.platform,
            followers: metrics.followers ?? null,
            following: metrics.following ?? null,
            posts_count: metrics.postsCount ?? null,
            impressions: metrics.impressions ?? null,
            reach: metrics.reach ?? null,
            profile_views: metrics.profileViews ?? null,
            engagements: metrics.engagements ?? null,
            raw: metrics.raw ?? null,
            collected_at: new Date().toISOString(),
          },
          // One row per account per DAY. Without this a retry would append a
          // second row for today and double the day in any chart.
          { onConflict: 'profile_id,platform,collected_for' }
        )

        if (error) throw new Error(`account_analytics upsert failed: ${error.message}`)
        return 'collected' as const
      })

      if (outcome === 'collected') collected++
      else if (outcome === 'unsupported' || outcome === 'empty') skipped++
      else failed++
    }

    return { collected, skipped, failed, accounts: tokens.length }
  }
)
