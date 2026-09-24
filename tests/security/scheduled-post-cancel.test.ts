import { describe, it, expect, vi, beforeEach } from 'vitest'

// A scheduled post sleeps inside Inngest until its send time. Cancel and
// reschedule only touch the DATABASE — neither can recall the sleeping event.
// So the worker must re-read state on wake. Before the fix it did not, and a
// post the user had cancelled published anyway.

const fanOutMock = vi.fn()
vi.mock('@/lib/fan-out', () => ({
  fanOut: (...a: unknown[]) => fanOutMock(...a),
  rethrowTupleMismatch: (e: unknown) => { throw e },
}))

const singleMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => singleMock() }) }) }),
  },
}))

const created: Array<{ handler: (ctx: unknown) => Promise<unknown> }> = []
vi.mock('@/lib/inngest', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, handler: (ctx: unknown) => Promise<unknown>) => {
      created.push({ handler })
      return { handler }
    },
  },
}))

await import('@/inngest/functions/scheduled-post')
const handler = created[0].handler

// step.run executes inline; sleepUntil is a no-op so we land straight on wake.
const step = {
  sleepUntil: async () => undefined,
  run: async (_n: string, fn: () => unknown) => fn(),
}

function runWith(row: Record<string, unknown> | null, error: unknown = null) {
  singleMock.mockResolvedValue({ data: row, error })
  return handler({
    event: {
      data: {
        postId: 'p1', profileId: 'prof1',
        platforms: ['twitter'], scheduledFor: '2020-01-01T00:00:00.000Z',
      },
    },
    step,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  fanOutMock.mockResolvedValue([{ platform: 'twitter', success: true }])
})

describe('scheduled post honours current database state on wake', () => {
  it('does NOT publish a post that was cancelled (status draft)', async () => {
    const res = await runWith({ status: 'draft', scheduled_for: null })
    expect(fanOutMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true })
  })

  it('does NOT publish a post that was rescheduled into the future', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    const res = await runWith({ status: 'pending', scheduled_for: future })
    expect(fanOutMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true })
  })

  it('does NOT publish a post that no longer exists', async () => {
    const res = await runWith(null)
    expect(fanOutMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true })
  })

  it('does NOT publish when the status read fails — it throws so Inngest retries', async () => {
    // Failing open here would publish on unknown state, which is the same
    // user-visible bug as ignoring the cancel.
    await expect(runWith(null, { message: 'db down' })).rejects.toThrow(/recheck failed/)
    expect(fanOutMock).not.toHaveBeenCalled()
  })

  // CX probe: a +30s reschedule slipped through the old 60s tolerance window
  // and published at the OLD time. Any tolerance publishes early by its width.
  it('does NOT publish a post rescheduled only 30 seconds later', async () => {
    const soon = new Date(Date.parse('2020-01-01T00:00:00.000Z') + 30_000).toISOString()
    const res = await runWith({ status: 'pending', scheduled_for: soon })
    expect(fanOutMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true })
  })

  it('does NOT publish a post rescheduled one second later', async () => {
    const soon = new Date(Date.parse('2020-01-01T00:00:00.000Z') + 1_000).toISOString()
    const res = await runWith({ status: 'pending', scheduled_for: soon })
    expect(fanOutMock).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true })
  })

  it('DOES publish a post still pending at its scheduled time', async () => {
    const res = await runWith({ status: 'pending', scheduled_for: '2020-01-01T00:00:00.000Z' })
    expect(fanOutMock).toHaveBeenCalledWith('p1', ['twitter'], 'prof1')
    expect(res).toMatchObject({ postId: 'p1' })
  })
})
