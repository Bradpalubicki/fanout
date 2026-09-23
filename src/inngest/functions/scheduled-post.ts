import { inngest } from '@/lib/inngest'
import { fanOut, rethrowTupleMismatch } from '@/lib/fan-out'

export const scheduledPost = inngest.createFunction(
  {
    id: 'scheduled-post',
    retries: 3,
  },
  { event: 'social/post.scheduled' },
  async ({ event, step }) => {
    const { postId, profileId, platforms, scheduledFor } = event.data as {
      postId: string
      profileId: string
      platforms: string[]
      scheduledFor: string
    }

    // Wait until scheduled time
    await step.sleepUntil('wait-for-schedule', scheduledFor)

    // Rechecked here, not only at enqueue time: a post's ownership or target
    // platforms can change during the sleepUntil window above.
    const results = await step.run('fan-out-scheduled', async () => {
      return fanOut(postId, platforms, profileId).catch(rethrowTupleMismatch)
    })

    return { postId, results }
  }
)
