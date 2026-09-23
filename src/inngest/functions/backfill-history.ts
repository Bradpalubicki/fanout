import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import { decryptToken, TokenCorruptError } from '@/lib/crypto'
import { DISTRIBUTORS } from '@/lib/fan-out'
import { NativeHistoryUnsupportedError, type NativePost } from '@/distributors/base'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'

/**
 * Native history backfill — imports posts an account created OUTSIDE Fanout.
 *
 * Ayrshare leads its AI pitch with this: an agent needs a client's real posting
 * history (most of which predates us) to write in their voice. It is the single
 * competitive gap we can close from data we are already entitled to read.
 *
 * Runs ONE page per invocation and re-emits itself for the next page. Doing the
 * whole backfill in a single run would blow Inngest step timeouts on a 500-post
 * account and, worse, lose all progress on a mid-run failure. One page per run
 * means a crash costs one page, not the whole import.
 */

/** Ceiling on pages per account, so a mispaginating provider cannot loop forever. */
const MAX_PAGES = 25
const PAGE_SIZE = 25

export const backfillHistory = inngest.createFunction(
  {
    id: 'backfill-history',
    retries: 2,
    // One backfill per profile+platform at a time. Two concurrent runs sharing
    // a cursor would re-read the same page and fight over sync state.
    concurrency: { key: 'event.data.profileId + "-" + event.data.platform', limit: 1 },
  },
  { event: 'social/history.backfill' },
  async ({ event, step }) => {
    const { profileId, platform } = event.data as { profileId: string; platform: string }

    const config = OAUTH_CONFIGS[platform]
    if (!config?.nativeHistory) {
      // A fact about the provider's scopes, not a transient failure. Retrying
      // can never make it true, so record and stop.
      await step.run('record-unsupported', async () => {
        await supabase.from('external_post_sync_state').upsert(
          {
            profile_id: profileId,
            platform,
            last_run_at: new Date().toISOString(),
            last_error: config
              ? (config.nativeHistoryBlocker ?? 'native history unavailable')
              : 'unknown platform',
            backfill_completed_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id,platform' }
        )
      })
      return { skipped: 'unsupported', platform }
    }

    const state = await step.run('load-sync-state', async () => {
      const { data } = await supabase
        .from('external_post_sync_state')
        .select('cursor, posts_imported, backfill_completed_at')
        .eq('profile_id', profileId)
        .eq('platform', platform)
        .maybeSingle()
      return data
    })

    if (state?.backfill_completed_at) {
      return { skipped: 'already-complete', platform }
    }

    const token = await step.run('load-token', async () => {
      const { data } = await supabase
        .from('oauth_tokens')
        .select('access_token, platform_page_id, platform_user_id')
        .eq('profile_id', profileId)
        .eq('platform', platform)
        .maybeSingle()
      return data
    })

    if (!token) {
      return { skipped: 'no-token', platform }
    }

    // Decrypt OUTSIDE step.run: a step's return value is persisted by Inngest,
    // so returning a plaintext token would write the credential into step state.
    let accessToken: string
    try {
      accessToken = await decryptToken(token.access_token)
    } catch (err) {
      if (err instanceof TokenCorruptError) {
        // Permanently unusable — retrying can never succeed. Record and stop
        // rather than letting Inngest burn its retries.
        await step.run('record-corrupt-token', async () => {
          await supabase.from('external_post_sync_state').upsert(
            {
              profile_id: profileId,
              platform,
              last_run_at: new Date().toISOString(),
              last_error: `token could not be decrypted: ${err.message}`,
            },
            { onConflict: 'profile_id,platform' }
          )
        })
        return { skipped: 'corrupt-token', platform }
      }
      // TokenDecryptUnavailableError and anything else: rethrow so Inngest
      // retries. Swallowing it would discard a VALID credential.
      throw err
    }

    const distributor = DISTRIBUTORS[platform]
    if (!distributor) return { skipped: 'no-distributor', platform }

    // Facebook needs the Page id, Instagram the IG user id; both live in
    // platform_page_id. Twitter resolves its own when absent.
    const accountId = token.platform_page_id ?? token.platform_user_id ?? undefined

    const page = await step.run('fetch-page', async () => {
      try {
        const result = await distributor.listPosts(
          accessToken,
          { cursor: state?.cursor ?? undefined, limit: PAGE_SIZE },
          accountId
        )
        return { ok: true as const, posts: result.posts, nextCursor: result.nextCursor }
      } catch (err) {
        if (err instanceof NativeHistoryUnsupportedError) {
          return { ok: false as const, reason: err.message }
        }
        throw err
      }
    })

    if (!page.ok) {
      await step.run('record-unsupported-runtime', async () => {
        await supabase.from('external_post_sync_state').upsert(
          {
            profile_id: profileId,
            platform,
            last_run_at: new Date().toISOString(),
            last_error: page.reason,
            backfill_completed_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id,platform' }
        )
      })
      return { skipped: 'unsupported-runtime', platform }
    }

    const imported = await step.run('persist-page', async () => {
      const posts = page.posts as NativePost[]
      if (!posts.length) return 0

      const rows = posts.map((p) => ({
        profile_id: profileId,
        platform,
        platform_post_id: p.platformPostId,
        platform_post_url: p.platformPostUrl ?? null,
        content: p.content ?? null,
        media_urls: p.mediaUrls?.length ? p.mediaUrls : null,
        published_at: p.publishedAt?.toISOString() ?? null,
        origin: 'native',
        metrics: p.metrics ?? null,
        last_synced_at: new Date().toISOString(),
      }))

      // Upsert on the natural key so a re-run UPDATES rather than duplicating.
      // external_posts_natural_key is a real UNIQUE constraint (contype='u'),
      // which is what makes ON CONFLICT work at all.
      const { error } = await supabase
        .from('external_posts')
        .upsert(rows, { onConflict: 'profile_id,platform,platform_post_id' })

      if (error) throw new Error(`external_posts upsert failed: ${error.message}`)
      return rows.length
    })

    const totalImported = (state?.posts_imported ?? 0) + imported
    const pagesSoFar = Math.ceil(totalImported / PAGE_SIZE)
    // No cursor means the provider says there are no more pages. The page cap is
    // a guard against a provider that keeps returning one.
    const isComplete = !page.nextCursor || pagesSoFar >= MAX_PAGES

    await step.run('save-sync-state', async () => {
      await supabase.from('external_post_sync_state').upsert(
        {
          profile_id: profileId,
          platform,
          cursor: page.nextCursor ?? null,
          posts_imported: totalImported,
          last_run_at: new Date().toISOString(),
          last_error: null,
          // Only set once the import is genuinely finished. Until then
          // incremental sync must not start, or it leaves a permanent hole in
          // the middle of history.
          backfill_completed_at: isComplete ? new Date().toISOString() : null,
        },
        { onConflict: 'profile_id,platform' }
      )
    })

    if (!isComplete) {
      // Re-emit for the next page. Progress is durable in sync state, so a
      // failure here costs one page rather than the whole backfill.
      await step.sendEvent('next-page', {
        name: 'social/history.backfill',
        data: { profileId, platform },
      })
    }

    return { platform, imported, totalImported, complete: isComplete }
  }
)
