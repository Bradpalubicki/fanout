import { inngest } from '@/lib/inngest'
import { fanOut, rethrowTupleMismatch } from '@/lib/fan-out'

/**
 * Consumer for `social/post.retry`.
 *
 * retry-failed.ts (cron) emits one event per failed post_results row, but nothing
 * listened for it — the events were discarded and retries silently never ran.
 *
 * This retries ONLY the single failed platform, never the whole post, so a partial
 * failure cannot republish to destinations that already succeeded.
 */
export const retryPost = inngest.createFunction(
  {
    id: 'retry-post',
    retries: 2,
  },
  { event: 'social/post.retry' },
  async ({ event, step }) => {
    const { postId, platform, profileId } = event.data as {
      postId: string
      platform: string
      profileId?: string
    }

    if (!postId || !platform || !profileId) {
      return { skipped: true, reason: 'missing postId, platform or profileId' }
    }

    // Rechecked on every retry: the retry event carries profileId as data,
    // and a replayed or crafted event must not bypass the binding.
    const results = await step.run('retry-single-platform', async () =>
      fanOut(postId, [platform], profileId).catch(rethrowTupleMismatch)
    )

    return { postId, platform, results }
  }
)
