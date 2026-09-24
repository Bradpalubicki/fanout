import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'

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

    // profileId comes from the posts!inner join above; fanOut() requires it.
    const events = failedPosts.map((r) => {
      const joined = (r as { posts?: { profile_id?: string } | { profile_id?: string }[] }).posts
      const profileId = Array.isArray(joined) ? joined[0]?.profile_id : joined?.profile_id
      return {
        name: 'social/post.retry' as const,
        data: { postId: r.post_id, platform: r.platform, profileId },
      }
    })

    // Incremented BEFORE dispatch, deliberately. Emitting first meant a failed
    // RPC still sent the retry events while attempts stayed 0, so the
    // .lt('attempts', 3) cap never engaged and a permanently failing post
    // retried every cycle forever — the very bug this was meant to close.
    // Throwing here aborts before any event is emitted; at worst a cycle is
    // skipped, which is recoverable. Over-counting a retry is safer than
    // uncapped re-sending.
    const resultIds = failedPosts.map((r) => r.post_id)
    await step.run('increment-attempts', async () => {
      // Checked, not swallowed: this RPC had no definition at all until
      // migration 020, and the unchecked await hid that for every retry cycle —
      // attempts stayed 0, so the .lt('attempts', 3) cap above never engaged and
      // a permanently failing post retried forever. Throwing surfaces a missing
      // or broken function instead of silently disabling the retry limit.
      const { error } = await supabase.rpc('increment_post_attempts', {
        post_ids: resultIds,
      })
      if (error) throw new Error(`increment_post_attempts failed: ${error.message}`)
    })

    await step.sendEvent('send-retry-events', events)


    return { retried: failedPosts.length }
  }
)
