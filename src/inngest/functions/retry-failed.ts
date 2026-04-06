import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import { fanOut } from '@/lib/fan-out'

export const retryFailedPosts = inngest.createFunction(
  {
    id: 'retry-failed-posts',
    concurrency: { limit: 1 },
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

    // Group by post_id to retry each post once with its failed platforms
    const byPost = new Map<string, { profileId: string; platforms: string[] }>()
    for (const r of failedPosts) {
      const post = r.posts as unknown as { profile_id: string }
      const existing = byPost.get(r.post_id)
      if (existing) {
        existing.platforms.push(r.platform)
      } else {
        byPost.set(r.post_id, { profileId: post.profile_id, platforms: [r.platform] })
      }
    }

    // Retry each post via fan-out (which handles posting + result recording)
    let retried = 0
    for (const [postId, { profileId, platforms }] of byPost) {
      await step.run(`retry-${postId}`, async () => {
        await fanOut(postId, platforms, profileId)
      })
      retried++
    }

    return { retried }
  }
)
