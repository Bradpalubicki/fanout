import { describe, it, expect, vi, beforeEach } from 'vitest'

// CX probe: with the increment AFTER sendEvent, four cron cycles under a failing
// RPC emitted four retry events while attempts stayed 0 — the .lt('attempts', 3)
// cap never engaged. The counter must be committed BEFORE any event is emitted,
// so a failed increment aborts the cycle instead of re-sending uncapped.

const rpcMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          lt: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    post_id: 'p1',
                    platform: 'twitter',
                    attempts: 0,
                    posts: { profile_id: 'prof1', platforms: ['twitter'], status: 'failed' },
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    }),
    rpc: (...a: unknown[]) => rpcMock(...a),
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

await import('@/inngest/functions/retry-failed')
const handler = created[0].handler

const sent: unknown[][] = []
const step = {
  run: async (_n: string, fn: () => unknown) => fn(),
  sendEvent: async (_n: string, events: unknown[]) => { sent.push(events) },
}

beforeEach(() => {
  vi.clearAllMocks()
  sent.length = 0
})

describe('retry cap cannot be bypassed by a failing counter', () => {
  it('emits NO retry events when the attempts RPC fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'function does not exist' } })

    await expect(handler({ step })).rejects.toThrow(/increment_post_attempts failed/)

    // The discriminating assertion. A cycle that throws but has ALREADY sent is
    // exactly the bug: Inngest retries the cron and re-sends every time.
    expect(sent).toHaveLength(0)
  })

  it('repeated failing cycles never emit an uncapped retry', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'function does not exist' } })
    for (let i = 0; i < 4; i++) {
      await handler({ step }).catch(() => undefined)
    }
    expect(sent).toHaveLength(0)
  })

  it('emits retry events once the counter succeeds', async () => {
    rpcMock.mockResolvedValue({ error: null })
    const res = await handler({ step })
    expect(sent).toHaveLength(1)
    expect(res).toMatchObject({ retried: 1 })
  })
})
