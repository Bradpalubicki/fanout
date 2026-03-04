import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'
import { DISTRIBUTORS } from '@/lib/fan-out'

export const collectAnalytics = inngest.createFunction(
  { id: 'collect-analytics', retries: 1 },
  [
    { event: 'social/analytics.collect' },
    { cron: '0 23 * * *' }, // Nightly at 11pm
  ],
  async ({ step }) => {
    const postResults = await step.run('find-recent-post-results', async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('post_results')
        .select('id, post_id, platform, platform_post_id, posts(profile_id)')
        .eq('status', 'success')
        .gte('posted_at', sevenDaysAgo)
        .not('platform_post_id', 'is', null)
      return data ?? []
    })

    if (!postResults.length) return { collected: 0 }

    let collected = 0

    for (const result of postResults) {
      await step.run(`collect-${result.id}`, async () => {
        const profileId = (result.posts as unknown as { profile_id: string } | null)?.profile_id
        if (!profileId) return

        const distributor = DISTRIBUTORS[result.platform]
        if (!distributor) return

        const { data: token } = await supabase
          .from('oauth_tokens')
          .select('access_token')
          .eq('profile_id', profileId)
          .eq('platform', result.platform)
          .single()

        if (!token?.access_token) return

        const accessToken = await decryptToken(token.access_token)
        const analytics = await distributor.getAnalytics(result.platform_post_id!, accessToken)

        await supabase.from('analytics_snapshots').upsert({
          post_result_id: result.id,
          platform: result.platform,
          impressions: analytics.impressions ?? null,
          likes: analytics.likes ?? null,
          comments: analytics.comments ?? null,
          shares: analytics.shares ?? null,
          clicks: analytics.clicks ?? null,
          reach: analytics.reach ?? null,
          collected_at: new Date().toISOString(),
        })

        collected++
      })
    }

    return { collected }
  }
)
