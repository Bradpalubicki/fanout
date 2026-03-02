import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import { fanOut } from '@/lib/fan-out'

export const retryFailedPosts = inngest.createFunction(
  {
    id: 'retry-failed-posts',
  },
  { cron: '*/30 * * * *' }, // Every 30 minutes
  async ({ step }) => {
    const failedPosts = await step.run('find-failed-posts', async () => {
      const { data } = await supabase
        .from('post_results')
        .select('post_id, platform, attempts, posts!inner(profile_id, platforms, status)')
        .eq('status', 'failed')
        .lt('attempts', 3)
        .order('created_at', { ascending: true })
        .limit(50)
      return data ?? []
    })

    if (!failedPosts.length) return { retried: 0 }

    const events = failedPosts.map((r) => ({
      name: 'social/post.retry' as const,
      data: { postId: r.post_id, platform: r.platform },
    }))

    await step.sendEvent('send-retry-events', events)

    // Increment attempt counter
    const resultIds = failedPosts.map((r) => r.post_id)
    await step.run('increment-attempts', async () => {
      await supabase.rpc('increment_post_attempts', { post_ids: resultIds })
    })

    return { retried: failedPosts.length }
  }
)
