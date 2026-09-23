import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'

const SRC = path.join(process.cwd(), 'src')
const fn = fs.readFileSync(path.join(SRC, 'inngest/functions/backfill-history.ts'), 'utf-8')
const registry = fs.readFileSync(path.join(SRC, 'app/api/inngest/route.ts'), 'utf-8')

/**
 * The backfill is the only writer into external_posts. Its failure modes are
 * silent by nature: a wrongly-completed backfill leaves a permanent hole in a
 * client's history, and nothing surfaces it later. These guard the decisions
 * that make it resumable and correct.
 */

describe('backfill registration', () => {
  /**
   * An Inngest function that is defined but not registered never runs. That
   * exact defect shipped once already: retry-failed emitted social/post.retry
   * with no consumer registered.
   */
  it('is registered in the inngest route', () => {
    expect(registry).toMatch(/import \{ backfillHistory \}/)
    expect(registry).toMatch(/^\s*backfillHistory,/m)
  })

  it('listens on social/history.backfill', () => {
    expect(fn).toMatch(/event: 'social\/history\.backfill'/)
  })

  /**
   * Two concurrent runs for one profile+platform share a cursor: they re-read
   * the same page and fight over sync state.
   */
  it('serialises per profile+platform', () => {
    expect(fn).toMatch(/concurrency:/)
    expect(fn).toMatch(/limit: 1/)
  })
})

describe('resumability', () => {
  // A whole 500-post backfill in one run blows step timeouts AND loses all
  // progress on failure. One page per run costs one page.
  it('processes one page then re-emits itself', () => {
    expect(fn).toMatch(/step\.sendEvent\(/)
    expect(fn).toMatch(/name: 'social\/history\.backfill'/)
  })

  it('persists the cursor so a retry resumes instead of restarting', () => {
    expect(fn).toMatch(/cursor: page\.nextCursor/)
    expect(fn).toMatch(/from\('external_post_sync_state'\)/)
  })

  it('does not re-emit once the provider reports no further pages', () => {
    expect(fn).toMatch(/if \(!isComplete\)/)
    expect(fn).toMatch(/!page\.nextCursor/)
  })

  // A provider that always returns a cursor would loop forever.
  it('caps total pages', () => {
    expect(fn).toMatch(/MAX_PAGES/)
    expect(fn).toMatch(/pagesSoFar >= MAX_PAGES/)
  })

  it('skips accounts whose backfill already completed', () => {
    expect(fn).toMatch(/already-complete/)
    expect(fn).toMatch(/state\?\.backfill_completed_at/)
  })
})

describe('correctness guards', () => {
  /**
   * backfill_completed_at set early lets incremental sync start before the
   * import finishes, leaving a permanent hole in the middle of history.
   */
  it('only stamps completion when the import is genuinely finished', () => {
    expect(fn).toMatch(/backfill_completed_at: isComplete \? new Date\(\)\.toISOString\(\) : null/)
  })

  // The natural key is a real UNIQUE constraint; upsert is what makes a re-run
  // idempotent rather than duplicating every post.
  it('upserts on the natural key rather than inserting', () => {
    expect(fn).toMatch(/\.upsert\(rows, \{ onConflict: 'profile_id,platform,platform_post_id' \}\)/)
  })

  it('fails loudly if the upsert errors instead of reporting success', () => {
    expect(fn).toMatch(/external_posts upsert failed/)
  })

  /**
   * A step's return value is persisted by Inngest. Returning a decrypted token
   * from inside step.run writes the credential into step state — the defect
   * fixed in 76534f8.
   */
  it('decrypts outside step.run so no plaintext token enters step state', () => {
    const decryptIdx = fn.indexOf('await decryptToken(')
    const stepBefore = fn.lastIndexOf('step.run(', decryptIdx)
    const closingBetween = fn.slice(stepBefore, decryptIdx).includes('})')
    expect(closingBetween || stepBefore === -1).toBe(true)
  })

  /**
   * F1: a corrupt token can never decrypt, so retrying is waste; an unavailable
   * one is transient and MUST be retried or a valid credential is discarded.
   */
  it('distinguishes corrupt tokens from transient decrypt failures', () => {
    expect(fn).toMatch(/TokenCorruptError/)
    expect(fn).toMatch(/corrupt-token/)
    // Anything not corrupt is rethrown so Inngest retries.
    expect(fn).toMatch(/throw err/)
  })

  it('records a reason when a platform cannot support native history', () => {
    expect(fn).toMatch(/NativeHistoryUnsupportedError/)
    expect(fn).toMatch(/nativeHistoryBlocker/)
  })
})

describe('platform gating matches the scope declarations', () => {
  // The job must never attempt a read the granted scopes do not permit.
  it('checks nativeHistory before doing any work', () => {
    const gateIdx = fn.indexOf('config?.nativeHistory')
    const tokenIdx = fn.indexOf("from('oauth_tokens')")
    expect(gateIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(tokenIdx)
  })

  it('every platform the job can run on declares nativeHistory', () => {
    const enabled = Object.entries(OAUTH_CONFIGS).filter(([, c]) => c.nativeHistory)
    expect(enabled.length).toBeGreaterThan(4)
    for (const [, cfg] of enabled) {
      expect(cfg.nativeHistoryBlocker).toBeNull()
    }
  })
})
