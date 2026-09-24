import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
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

    // The event carries the state from when it was ENQUEUED. After sleeping,
    // that state may be stale, so the database is the authority on whether this
    // post should still go out:
    //   - cancel sets status 'draft' and scheduled_for null, but cannot recall
    //     an event already sleeping in Inngest. Without this check the post
    //     published anyway and the user was told it was cancelled.
    //   - reschedule updates scheduled_for WITHOUT emitting a new event, so
    //     this worker would otherwise fire at the ORIGINAL time.
    const decision = await step.run('recheck-post-state', async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('status, scheduled_for')
        .eq('id', postId)
        .single()

      // A read failure is not permission to publish. Throwing lets Inngest
      // retry rather than falling through to a send on unknown state.
      if (error) throw new Error(`recheck failed for post ${postId}: ${error.message}`)
      if (!data) return { send: false as const, reason: 'post no longer exists' }

      if (data.status !== 'pending') {
        return { send: false as const, reason: `status is "${data.status}", not "pending"` }
      }

      // Rescheduled into the future while we slept: this event is for the old
      // time. The reschedule route owns re-dispatch; this one must stand down.
      if (data.scheduled_for && new Date(data.scheduled_for).getTime() > Date.now() + 60_000) {
        return { send: false as const, reason: `rescheduled to ${data.scheduled_for}` }
      }

      return { send: true as const }
    })

    if (!decision.send) {
      return { postId, skipped: true, reason: decision.reason }
    }

    // Rechecked here, not only at enqueue time: a post's ownership or target
    // platforms can change during the sleepUntil window above.
    const results = await step.run('fan-out-scheduled', async () => {
      return fanOut(postId, platforms, profileId).catch(rethrowTupleMismatch)
    })

    return { postId, results }
  }
)
