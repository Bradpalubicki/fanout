import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Migration 016 added UNIQUE(post_id, platform) to post_results. supabase-js
// resolves an upsert's conflict target to the PRIMARY KEY unless onConflict is
// given, and `id` is never supplied by these writers — so every upsert behaved
// as an INSERT and, after 016, collides instead of updating. A retry could
// publish successfully while its result write failed, leaving the post recorded
// as failed.
//
// A dropped write is the second half of the same failure: a published post with
// no result row shows nothing in the UI, and the retry cron reads post_results,
// so it cannot see the failure either.

const SRC = path.join(process.cwd(), 'src')

describe('post_results writes name their conflict target', () => {
  it('enqueue.ts passes onConflict on its inline upsert', () => {
    const src = fs.readFileSync(path.join(SRC, 'lib/enqueue.ts'), 'utf-8')
    const needle = ".from('post_results').upsert("
    let i = 0
    let checked = 0
    for (;;) {
      const idx = src.indexOf(needle, i)
      if (idx < 0) break
      const open = idx + needle.length
      let depth = 0
      let end = -1
      for (let j = open; j < src.length; j++) {
        const c = src[j]
        if (c === '(' || c === '{' || c === '[') depth++
        else if (c === ')' && depth === 0) { end = j; break }
        else if (c === ')' || c === '}' || c === ']') depth--
      }
      expect(end).toBeGreaterThan(-1)
      expect(src.slice(open, end)).toMatch(/onConflict: 'post_id,platform'/)
      checked++
      i = end
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('fan-out.ts writes only through the helper, which sets onConflict', () => {
    const src = fs.readFileSync(path.join(SRC, 'lib/fan-out.ts'), 'utf-8')

    // Exactly ONE post_results writer may exist — the helper itself.
    // A second .from() would be a raw upsert bypassing both the conflict
    // target and the error check.
    const writerCount = src.split(".from('post_results')").length - 1
    expect(writerCount).toBe(1)
    expect(src).toMatch(/await writePostResult\(/)

    const helper = src.slice(src.indexOf('async function writePostResult'))
    expect(helper).toMatch(/onConflict: 'post_id,platform'/)
  })
})

describe('post_results write failures are surfaced, not discarded', () => {
  it('fan-out.ts helper checks the returned error', () => {
    const src = fs.readFileSync(path.join(SRC, 'lib/fan-out.ts'), 'utf-8')
    const helper = src.slice(src.indexOf('async function writePostResult'))
    expect(helper).toMatch(/const \{ error \}/)
    expect(helper).toMatch(/console\.error/)
  })

  it('enqueue.ts checks the returned error', () => {
    const src = fs.readFileSync(path.join(SRC, 'lib/enqueue.ts'), 'utf-8')
    expect(src).toMatch(/const \{ error \} = await supabase/)
    expect(src).toMatch(/console\.error/)
  })
})
