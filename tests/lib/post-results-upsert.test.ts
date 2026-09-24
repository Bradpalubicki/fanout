import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Migration 016 added UNIQUE(post_id, platform) to post_results. supabase-js
// resolves an upsert's conflict target to the PRIMARY KEY unless onConflict is
// given, and `id` is never supplied by these writers — so every upsert behaved
// as an INSERT and, after 016, collides with the unique constraint instead of
// updating the existing row. A retry could publish successfully while its
// result write failed, leaving the post recorded as failed.

const SRC = path.join(process.cwd(), 'src')
const FILES = ['lib/fan-out.ts', 'lib/enqueue.ts']

describe('every post_results upsert names its conflict target', () => {
  for (const rel of FILES) {
    it(`${rel} passes onConflict on every post_results upsert`, () => {
      const src = fs.readFileSync(path.join(SRC, rel), 'utf-8')

      // Walk each upsert call and check its own argument list, rather than
      // counting occurrences file-wide: a single correct call must not vouch
      // for a sibling that omits the option.
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
        const args = src.slice(open, end)
        expect(args, `upsert at index ${idx} in ${rel}`).toMatch(
          /onConflict:\s*'post_id,platform'/
        )
        checked++
        i = end
      }
      expect(checked).toBeGreaterThan(0)
    })
  }
})
