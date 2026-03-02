import { inngest } from '@/lib/inngest'
import { fanOut } from '@/lib/fan-out'

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

    const results = await step.run('fan-out-scheduled', async () => {
      return fanOut(postId, platforms, profileId)
    })

    return { postId, results }
  }
)
