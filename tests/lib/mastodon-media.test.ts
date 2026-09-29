import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MastodonDistributor } from '@/distributors/mastodon'

/**
 * Mastodon silently discarded payload.mediaUrls: the status body carried only
 * text, so a user attached an image, saw "posted", and the image was gone. Same
 * defect class as Twitter (cf9621f), Reddit (6c0472a), Threads (d46f44a).
 * Fixed 2026-09-24.
 *
 * These assert the STATUS CALL carries media_ids — not that post() returned
 * success, which it did throughout the entire defect.
 */

/** Non-zero, non-uniform bytes so an empty or zero-filled upload cannot pass. */
const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

const INSTANCE = 'https://mastodon.social'

function jsonRes(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 422,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response
}

function imageRes() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    // Distinguishable bytes; ArrayBuffer(64) was all zeros and a discarded-bytes
    // stub was indistinguishable from a correct upload. Asserted for equality below.
    arrayBuffer: async () => IMAGE_BYTES.buffer.slice(0),
  } as unknown as Response
}

/** Route by URL so assertions do not depend on call ordering. */
function mockFetch(opts: { uploadOk?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  let uploadSeq = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.includes('/api/v2/media')) {
        if (opts.uploadOk === false) return jsonRes({ error: 'nope' }, false)
        return jsonRes({ id: `media-${++uploadSeq}` })
      }
      if (url.includes('/api/v1/statuses')) return jsonRes({ id: 's1', url: `${INSTANCE}/@me/s1` })
      return imageRes() // the source image fetch
    })
  )
  return calls
}

function statusBody(calls: { url: string; init?: RequestInit }[]) {
  const s = calls.find((c) => c.url.includes('/api/v1/statuses'))
  return s ? (JSON.parse(String(s.init?.body)) as Record<string, unknown>) : null
}

describe('mastodon media upload', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('attaches media_ids to the status when media is uploaded', async () => {
    const calls = mockFetch()
    const res = await new MastodonDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok',
      INSTANCE
    )

    expect(res.success).toBe(true)
    const body = statusBody(calls)
    // The discriminator: the defect posted a status with no media_ids at all.
    expect(body!.media_ids).toEqual(['media-1'])
  })

  it('uploads the bytes to v2/media as multipart', async () => {
    const calls = mockFetch()
    await new MastodonDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok',
      INSTANCE
    )

    const upload = calls.find((c) => c.url.includes('/api/v2/media'))
    expect(upload, 'never uploaded to v2/media').toBeDefined()
    expect(upload!.url).toBe(`${INSTANCE}/api/v2/media`)
    const form = upload!.init?.body as FormData
    expect(form).toBeInstanceOf(FormData)
    const file = form.get('file')
    expect(file).toBeInstanceOf(Blob)
    // BYTE EQUALITY. A stub sending a 0-byte Blob passed the old instanceof check.
    const sent = new Uint8Array(await (file as Blob).arrayBuffer())
    expect(sent.byteLength).toBe(IMAGE_BYTES.byteLength)
    expect(Array.from(sent)).toEqual(Array.from(IMAGE_BYTES))
  })

  it('attaches up to 4 images and ignores the rest', async () => {
    const calls = mockFetch()
    await new MastodonDistributor().post(
      {
        content: 'hello',
        mediaUrls: [1, 2, 3, 4, 5].map((n) => `https://cdn.example.com/${n}.jpg`),
      },
      'tok',
      INSTANCE
    )

    expect(calls.filter((c) => c.url.includes('/api/v2/media'))).toHaveLength(4)
    expect(statusBody(calls)!.media_ids).toHaveLength(4)
  })

  it('posts the text anyway when every upload fails', async () => {
    const calls = mockFetch({ uploadOk: false })
    const res = await new MastodonDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok',
      INSTANCE
    )

    // Deliberately unlike Reddit: a status is the same kind of object with or
    // without an attachment, so losing the image degrades the post rather than
    // changing what it is. Losing the whole post would be worse.
    expect(res.success).toBe(true)
    const body = statusBody(calls)
    expect(body!.status).toBe('hello')
    expect(body!.media_ids).toBeUndefined()
  })

  it('posts text normally with no media, making no upload calls', async () => {
    const calls = mockFetch()
    const res = await new MastodonDistributor().post({ content: 'just text' }, 'tok', INSTANCE)

    expect(res.success).toBe(true)
    expect(statusBody(calls)!.media_ids).toBeUndefined()
    expect(calls.some((c) => c.url.includes('/api/v2/media'))).toBe(false)
  })
})
