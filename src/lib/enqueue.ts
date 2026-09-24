import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'

type InngestPayload = Parameters<typeof inngest.send>[0]

/**
 * Send an Inngest event for a post, and record a failure if the queue rejects it.
 *
 * Posting routes insert the `posts` row first and then enqueue the work. If
 * `inngest.send()` throws (bad/revoked event key, Inngest outage), an unguarded
 * `await` returns a 500 and the row is stranded at status `pending` forever:
 * nothing publishes it, and the retry cron only looks at `post_results` rows with
 * status `failed`, which never get written because fanOut() never ran.
 *
 * This marks the post `failed` and writes a post_results row per platform, so the
 * failure is visible in the dashboard and eligible for retry.
 *
 * Returns true when the event was accepted.
 */
export async function enqueuePostEvent(
  payload: InngestPayload,
  context: { postId: string; platforms?: string[] }
): Promise<boolean> {
  try {
    await inngest.send(payload)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const reason = `Queue unavailable — post was not dispatched: ${message}`

    try {
      await supabase.from('posts').update({ status: 'failed' }).eq('id', context.postId)

      const platforms = context.platforms ?? []
      if (platforms.length) {
        // Checked, not discarded. If this write fails the post is marked failed
        // but carries no per-platform rows, so the dashboard shows an empty
        // failure and the retry cron (which reads post_results) cannot see it.
        const { error } = await supabase.from('post_results').upsert(
          platforms.map((platform) => ({
            post_id: context.postId,
            platform,
            status: 'failed',
            error_message: reason,
          })),
          { onConflict: 'post_id,platform' }
        )
        if (error) {
          console.error(
            '[enqueue] post_results write FAILED — failure is invisible to retry:',
            error.message,
            context.postId
          )
        }
      }
    } catch {
      // Never let bookkeeping mask the original queue failure.
    }

    return false
  }
}
