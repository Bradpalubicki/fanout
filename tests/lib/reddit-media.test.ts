import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RedditDistributor } from '@/distributors/reddit'

/**
 * Reddit silently discarded payload.mediaUrls: every post went out as
 * kind:'self' text, the user saw "posted", and the image was gone. Same defect
 * class as Twitter (cf9621f). Fixed 2026-09-24.
 *
 * These assert the SUBMIT CALL ITSELF carries the image — not that post()
 * returned success, which it did throughout the entire defect.
 */

const LEASE = {
  args: {
    action: '//reddit-uploaded-media.s3-accelerate.amazonaws.com',
    fields: [
      { name: 'key', value: 'abc123/upload.jpg' },
      { name: 'x-amz-signature', value: 'sig' },
    ],
  },
}

const SUBMIT_OK = { json: { data: { id: 'p1', url: 'https://reddit.com/r/test/p1' }, errors: [] } }

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
    arrayBuffer: async () => new ArrayBuffer(64),
  } as unknown as Response
}

/** Route by URL so the assertions do not depend on call ordering. */
function mockFetch(opts: { leaseOk?: boolean; uploadOk?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.includes('media/asset.json')) {
      return jsonRes(opts.leaseOk === false ? {} : LEASE, opts.leaseOk !== false)
    }
    if (url.includes('amazonaws.com')) {
      return jsonRes({}, opts.uploadOk !== false)
    }
    if (url.includes('api/submit')) return jsonRes(SUBMIT_OK)
    return imageRes() // the source image fetch
  })
  vi.stubGlobal('fetch', fn)
  return calls
}

function submitBody(calls: { url: string; init?: RequestInit }[]) {
  const submit = calls.find((c) => c.url.includes('api/submit'))
  if (!submit) return null
  return new URLSearchParams(String(submit.init?.body))
}

describe('reddit media upload', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('submits kind=image with the uploaded asset url when media is attached', async () => {
    const calls = mockFetch()
    const res = await new RedditDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok',
      'testsub'
    )

    expect(res.success).toBe(true)

    const body = submitBody(calls)
    expect(body, 'no submit call was made').not.toBeNull()
    // The discriminator: a text submission would say kind=self and carry no url.
    expect(body!.get('kind')).toBe('image')
    expect(body!.get('url')).toContain('abc123/upload.jpg')
  })

  it('actually uploads the bytes to the leased S3 url', async () => {
    const calls = mockFetch()
    await new RedditDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok'
    )

    const lease = calls.find((c) => c.url.includes('media/asset.json'))
    const upload = calls.find((c) => c.url.includes('amazonaws.com'))
    expect(lease, 'never requested an upload lease').toBeDefined()
    expect(upload, 'never sent the bytes to S3').toBeDefined()
    // Lease fields are signature material — all of them must be on the form.
    const form = upload!.init?.body as FormData
    expect(form.get('key')).toBe('abc123/upload.jpg')
    expect(form.get('x-amz-signature')).toBe('sig')
    expect(form.get('file')).toBeInstanceOf(Blob)
  })

  it('FAILS the post when the upload fails — never silently posts text instead', async () => {
    const calls = mockFetch({ uploadOk: false })
    const res = await new RedditDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok'
    )

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/image upload failed/i)
    // The defect being guarded: degrading to a text post is NOT an acceptable
    // fallback — it publishes a different kind of post than the user asked for.
    expect(submitBody(calls), 'submitted a text post after the image failed').toBeNull()
  })

  it('fails the post when the lease request fails', async () => {
    const calls = mockFetch({ leaseOk: false })
    const res = await new RedditDistributor().post(
      { content: 'hello', mediaUrls: ['https://cdn.example.com/cat.jpg'] },
      'tok'
    )
    expect(res.success).toBe(false)
    expect(submitBody(calls)).toBeNull()
  })

  it('still posts text normally when no media is attached', async () => {
    const calls = mockFetch()
    const res = await new RedditDistributor().post({ content: 'just text' }, 'tok', 'testsub')

    expect(res.success).toBe(true)
    const body = submitBody(calls)
    expect(body!.get('kind')).toBe('self')
    expect(body!.get('text')).toBe('just text')
    expect(body!.get('url')).toBeNull()
    // No media means no upload round trips at all.
    expect(calls.some((c) => c.url.includes('media/asset.json'))).toBe(false)
  })
})
