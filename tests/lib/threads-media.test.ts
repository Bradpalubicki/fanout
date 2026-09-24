import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ThreadsDistributor } from '@/distributors/threads'

/**
 * Threads silently discarded payload.mediaUrls: media_type was hardcoded to
 * TEXT, so an attached image never reached the container and the user saw
 * "posted" with no image. Same defect class as Twitter (cf9621f) and Reddit.
 * Fixed 2026-09-24.
 *
 * These assert the CONTAINER CALL carries the image — not that post() returned
 * success, which it did throughout the entire defect.
 */

function jsonRes(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response
}

function mockFetch() {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
      if (url.includes('threads_publish')) return jsonRes({ id: 'published-1' })
      return jsonRes({ id: 'container-1' })
    })
  )
  return calls
}

const container = (c: { url: string; body: Record<string, unknown> }[]) =>
  c.find((x) => x.url.includes('/threads') && !x.url.includes('threads_publish'))

describe('threads media upload', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('creates an IMAGE container carrying image_url when media is attached', async () => {
    const calls = mockFetch()
    const res = await new ThreadsDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok',
      'user-1'
    )

    expect(res.success).toBe(true)
    const c = container(calls)!
    expect(c, 'no container call was made').toBeDefined()
    // The discriminator: the defect produced media_type TEXT and no image_url.
    expect(c.body.media_type).toBe('IMAGE')
    expect(c.body.image_url).toBe('https://cdn.example.com/cat.jpg')
  })

  it('publishes the container it created', async () => {
    const calls = mockFetch()
    await new ThreadsDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok',
      'user-1'
    )
    const pub = calls.find((c) => c.url.includes('threads_publish'))
    expect(pub, 'never published the container').toBeDefined()
    expect(pub!.body.creation_id).toBe('container-1')
  })

  it('keeps the single-step TEXT container when no media is attached', async () => {
    const calls = mockFetch()
    const res = await new ThreadsDistributor().post({ content: 'just text' }, 'tok', 'user-1')

    expect(res.success).toBe(true)
    const c = container(calls)!
    expect(c.body.media_type).toBe('TEXT')
    expect(c.body.text).toBe('just text')
    expect(c.body.image_url).toBeUndefined()
  })
})
