import { describe, it, expect, vi, beforeEach } from 'vitest'

// writePostResult is bookkeeping INSIDE the delivery path. It must never throw:
// a thrown bookkeeping error masks the real publish outcome and can fail a post
// that actually published. But it must never go quiet either — a dropped write
// leaves a published post with no result row, invisible to both the dashboard
// and the retry cron (which reads post_results).
//
// CX probe: the first version handled a RETURNED { error } but not a REJECTED
// promise. An injected rejection produced zero logs and a rejected call.

const upsertMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { from: () => ({ upsert: (...a: unknown[]) => upsertMock(...a) }) },
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...a: unknown[]) => upsertMock(...a) }) },
}))

const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

const { writePostResult } = await import('@/lib/fan-out')

beforeEach(() => {
  vi.clearAllMocks()
  errSpy.mockClear()
})

describe('writePostResult never throws and never goes quiet', () => {
  it('logs and resolves when the write REJECTS', async () => {
    upsertMock.mockRejectedValue(new Error('socket hang up'))
    await expect(writePostResult({ post_id: 'p1', platform: 'twitter' })).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
  })

  it('logs and resolves when the write returns an error', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'duplicate key' } })
    await expect(writePostResult({ post_id: 'p1', platform: 'twitter' })).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
  })
})

// Source-level guarantee, independent of whether the helper is exported: both
// failure modes must be handled, and neither may rethrow.
describe('writePostResult source shape', () => {
  it('wraps the write in try/catch and logs both failure modes', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/fan-out.ts'),
      'utf-8'
    )
    const start = src.indexOf('async function writePostResult')
    expect(start).toBeGreaterThan(-1)
    const helper = src.slice(start, src.indexOf('\n}\n', start) + 3)

    expect(helper).toMatch(/try \{/)
    expect(helper).toMatch(/\} catch \(err\) \{/)
    // returned-error branch
    expect(helper).toMatch(/if \(error\)/)
    // both branches log
    expect((helper.match(/console\.error/g) ?? []).length).toBeGreaterThanOrEqual(2)
    // and neither rethrows
    expect(helper).not.toMatch(/throw /)
  })
})
