import { inngest } from '@/lib/inngest'
import { fanOut } from '@/lib/fan-out'

export const fanOutPost = inngest.createFunction(
  {
    id: 'fan-out-post',
    retries: 3,
  },
  { event: 'social/post.created' },
  async ({ event, step }) => {
    const { postId, profileId, platforms } = event.data as {
      postId: string
      profileId: string
      platforms: string[]
    }

    const results = await step.run('fan-out-to-platforms', async () => {
      return fanOut(postId, platforms, profileId)
    })

    return { postId, results }
  }
)
