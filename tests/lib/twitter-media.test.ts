import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TwitterDistributor } from '@/distributors/twitter'

/**
 * Twitter's post() had NO test at all. CX proved it on 2026-09-28: inserting an
 * immediate failure return into the real post() left ALL 406 tests passing,
 * because the only file touching TwitterDistributor exercised listPosts.
 *
 * The media fix itself shipped in cf9621f with no test.
 *
 * These assert the TWEET CALL body — not that post() returned success, which it
 * did throughout the entire media-discarding defect.
 *
 * They also pin BOTH directions of the platform failure policy, which differs
 * from Reddit's BY DESIGN and must not be "made consistent":
 *   - Twitter/Mastodon: upload fails -> POST THE TEXT ANYWAY (a tweet is the same
 *     object with or without an attachment).
 *   - Reddit: upload fails -> FAIL THE POST (kind image vs kind self are
 *     different post types; a silent downgrade publishes something else).
 */

/** Non-zero, non-uniform bytes so an empty or zero-filled upload cannot pass. */
const IMAGE_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

function jsonRes(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response
}

function imageRes() {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: async () => IMAGE_BYTES.buffer.slice(0),
  } as unknown as Response
}

/** Route by URL so assertions do not depend on call ordering. */
function mockFetch(opts: { uploadOk?: boolean; tweetOk?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  let uploadSeq = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.includes('upload.twitter.com')) {
        if (opts.uploadOk === false) return jsonRes({ errors: [{ message: 'nope' }] }, false)
        return jsonRes({ media_id_string: `media-${++uploadSeq}` })
      }
      if (url.includes('api.twitter.com/2/tweets')) {
        if (opts.tweetOk === false) return jsonRes({ errors: [{ message: 'rejected' }] }, false)
        return jsonRes({ data: { id: 't1', text: 'hello' } })
      }
      return imageRes() // the source image fetch
    })
  )
  return calls
}

function tweetBody(calls: { url: string; init?: RequestInit }[]) {
  const t = calls.find((c) => c.url.includes('api.twitter.com/2/tweets'))
  return t ? (JSON.parse(String(t.init?.body)) as Record<string, unknown>) : null
}

describe('twitter post()', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('posts the text with no media key when nothing is attached', async () => {
    const calls = mockFetch()
    const res = await new TwitterDistributor().post({ content: 'hello' }, 'tok')

    expect(res.success).toBe(true)
    // The discriminator against a disabled post(): a tweet call must exist.
    const body = tweetBody(calls)
    expect(body, 'never called POST /2/tweets').not.toBeNull()
    expect(body!.text).toBe('hello')
    expect(body!.media).toBeUndefined()
    expect(calls.some((c) => c.url.includes('upload.twitter.com'))).toBe(false)
  })

  it('attaches media_ids to the tweet when media is uploaded', async () => {
    const calls = mockFetch()
    const res = await new TwitterDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok'
    )

    expect(res.success).toBe(true)
    const body = tweetBody(calls)
    expect(body, 'never called POST /2/tweets').not.toBeNull()
    // The defect produced a tweet body with no media key at all.
    expect(body!.media).toEqual({ media_ids: ['media-1'] })
  })

  it('uploads the bytes to upload.twitter.com', async () => {
    const calls = mockFetch()
    await new TwitterDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok'
    )

    const upload = calls.find((c) => c.url.includes('upload.twitter.com'))
    expect(upload, 'never uploaded the bytes').toBeDefined()
    const form = upload!.init?.body as FormData
    // Twitter differs from reddit/mastodon: it sends base64 TEXT in 'media_data',
    // not a Blob. Assert the real contract, not the shape the siblings use.
    const mediaData = form.get('media_data')
    expect(typeof mediaData, "media_data missing from the upload form").toBe('string')
    // BYTE EQUALITY via the base64 payload. A stub discarding the file contents
    // sends an empty string and would satisfy a mere presence check.
    const sent = new Uint8Array(Buffer.from(String(mediaData), 'base64'))
    expect(sent.byteLength).toBe(IMAGE_BYTES.byteLength)
    expect(Array.from(sent)).toEqual(Array.from(IMAGE_BYTES))
  })

  it('attaches up to 4 images and ignores the rest', async () => {
    const calls = mockFetch()
    await new TwitterDistributor().post(
      {
        content: 'hello',
        mediaUrls: [
          'https://cdn.example.com/1.jpg',
          'https://cdn.example.com/2.jpg',
          'https://cdn.example.com/3.jpg',
          'https://cdn.example.com/4.jpg',
          'https://cdn.example.com/5.jpg',
        ],
      },
      'tok'
    )

    const uploads = calls.filter((c) => c.url.includes('upload.twitter.com'))
    expect(uploads).toHaveLength(4)
    const ids = (tweetBody(calls)!.media as { media_ids: string[] }).media_ids
    expect(ids).toHaveLength(4)
  })

  it('POSTS THE TEXT ANYWAY when every upload fails — policy differs from reddit', async () => {
    const calls = mockFetch({ uploadOk: false })
    const res = await new TwitterDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok'
    )

    // Losing the image is bad; losing the whole post because of it is worse.
    // Reddit deliberately does the OPPOSITE — a mutant swapping the two fails here.
    expect(res.success).toBe(true)
    const body = tweetBody(calls)
    expect(body, 'text was not posted after upload failure').not.toBeNull()
    expect(body!.text).toBe('hello')
    // No empty media key: an empty media_ids array is rejected by the API.
    expect(body!.media).toBeUndefined()
  })

  it('fails when the tweet call itself fails', async () => {
    const calls = mockFetch({ tweetOk: false })
    const res = await new TwitterDistributor().post({ content: 'hello' }, 'tok')

    // Guards the inverse of the fallback: a failed publish must not report success.
    expect(res.success).toBe(false)
    expect(tweetBody(calls)).not.toBeNull()
  })
})
