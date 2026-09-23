import { describe, it, expect, vi, afterEach } from 'vitest'
import { NativeHistoryUnsupportedError } from '@/distributors/base'
import { FacebookDistributor } from '@/distributors/facebook'
import { InstagramDistributor } from '@/distributors/instagram'
import { TwitterDistributor } from '@/distributors/twitter'
import { LinkedInDistributor } from '@/distributors/linkedin'
import { BlueskyDistributor } from '@/distributors/bluesky'

afterEach(() => vi.unstubAllGlobals())

function stub(payload: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      json: async () => payload,
      headers: new Headers(),
    })
  )
}

describe('listPosts default — unimplemented must be LOUD, not empty', () => {
  /**
   * An empty list is a legitimate answer ("read fine, no posts"). If an
   * unimplemented platform returned [] instead of throwing, a backfill would
   * record success for an account whose history was never readable and never
   * retry. The default therefore throws.
   */
  it('throws NativeHistoryUnsupportedError rather than returning []', async () => {
    await expect(new LinkedInDistributor().listPosts('tok')).rejects.toBeInstanceOf(
      NativeHistoryUnsupportedError
    )
  })

  it('names the platform in the error so a failed backfill is diagnosable', async () => {
    await expect(new LinkedInDistributor().listPosts('tok')).rejects.toThrow(/linkedin/i)
  })
})

describe('FacebookDistributor.listPosts', () => {
  it('requires a Page id — the user feed is not the Page feed', async () => {
    await expect(new FacebookDistributor().listPosts('tok')).rejects.toBeInstanceOf(
      NativeHistoryUnsupportedError
    )
  })

  it('maps feed posts to the NativePost shape', async () => {
    stub({
      data: [
        {
          id: '123_456',
          message: 'hello',
          created_at: undefined,
          created_time: '2026-09-01T10:00:00+0000',
          permalink_url: 'https://fb.com/p/1',
          full_picture: 'https://img/1.jpg',
        },
      ],
      paging: { cursors: { after: 'CUR2' }, next: 'https://graph…' },
    })
    const r = await new FacebookDistributor().listPosts('tok', undefined, 'PAGE1')
    expect(r.posts).toHaveLength(1)
    expect(r.posts[0].platformPostId).toBe('123_456')
    expect(r.posts[0].content).toBe('hello')
    expect(r.posts[0].mediaUrls).toEqual(['https://img/1.jpg'])
    expect(r.posts[0].publishedAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z')
  })

  /**
   * The bug this prevents: returning cursors.after when `next` is absent makes
   * the backfill request the same final page forever.
   */
  it('returns no cursor on the final page even when cursors.after exists', async () => {
    stub({ data: [], paging: { cursors: { after: 'STALE' } } })
    const r = await new FacebookDistributor().listPosts('tok', undefined, 'PAGE1')
    expect(r.nextCursor).toBeUndefined()
  })

  it('returns a cursor while more pages remain', async () => {
    stub({ data: [], paging: { cursors: { after: 'CUR2' }, next: 'https://graph…' } })
    const r = await new FacebookDistributor().listPosts('tok', undefined, 'PAGE1')
    expect(r.nextCursor).toBe('CUR2')
  })

  it('throws on a provider error instead of reporting an empty history', async () => {
    stub({ error: { message: 'bad token' } }, 401)
    await expect(
      new FacebookDistributor().listPosts('tok', undefined, 'PAGE1')
    ).rejects.toThrow(/401/)
  })
})

describe('InstagramDistributor.listPosts', () => {
  it('requires an IG user id', async () => {
    await expect(new InstagramDistributor().listPosts('tok')).rejects.toBeInstanceOf(
      NativeHistoryUnsupportedError
    )
  })

  it('reads /media and keeps cumulative counters unsummed', async () => {
    stub({
      data: [
        {
          id: 'IG1',
          caption: 'cap',
          timestamp: '2026-09-02T12:00:00+0000',
          permalink: 'https://instagram.com/p/IG1/',
          media_url: 'https://img/a.jpg',
          like_count: 10,
          comments_count: 2,
        },
      ],
      paging: {},
    })
    const r = await new InstagramDistributor().listPosts('tok', undefined, 'IGUSER')
    expect(r.posts[0].metrics).toEqual({ likes: 10, comments: 2 })
    expect(r.posts[0].mediaUrls).toEqual(['https://img/a.jpg'])
    expect(r.nextCursor).toBeUndefined()
  })

  it('drops absent media urls rather than emitting undefined entries', async () => {
    stub({ data: [{ id: 'IG2', timestamp: '2026-09-02T12:00:00+0000' }], paging: {} })
    const r = await new InstagramDistributor().listPosts('tok', undefined, 'IGUSER')
    expect(r.posts[0].mediaUrls).toEqual([])
  })
})

describe('TwitterDistributor.listPosts', () => {
  /**
   * collect-inbox reads /mentions — what OTHERS wrote about the account. History
   * is the account's own tweets, so this must hit /users/{id}/tweets.
   */
  it('reads the account timeline, not mentions', async () => {
    const f = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ data: [], meta: {} }),
      headers: new Headers(),
    })
    vi.stubGlobal('fetch', f)
    await new TwitterDistributor().listPosts('tok', undefined, 'U1')
    const url = f.mock.calls[0][0] as string
    expect(url).toContain('/users/U1/tweets')
    expect(url).not.toContain('/mentions')
  })

  it('resolves the user id when the caller has only a token', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200, ok: true, headers: new Headers(),
        json: async () => ({ data: { id: 'ME9' } }),
      })
      .mockResolvedValueOnce({
        status: 200, ok: true, headers: new Headers(),
        json: async () => ({ data: [], meta: {} }),
      })
    vi.stubGlobal('fetch', f)
    await new TwitterDistributor().listPosts('tok')
    expect(f.mock.calls[0][0]).toContain('/users/me')
    expect(f.mock.calls[1][0]).toContain('/users/ME9/tweets')
  })

  // The API rejects max_results outside 5..100 with a 400 rather than clamping.
  it('clamps max_results into the API-legal range', async () => {
    const f = vi.fn().mockResolvedValue({
      status: 200, ok: true, headers: new Headers(),
      json: async () => ({ data: [], meta: {} }),
    })
    vi.stubGlobal('fetch', f)
    const d = new TwitterDistributor()
    await d.listPosts('tok', { limit: 1 }, 'U1')
    expect(f.mock.calls[0][0]).toContain('max_results=5')
    await d.listPosts('tok', { limit: 500 }, 'U1')
    expect(f.mock.calls[1][0]).toContain('max_results=100')
  })

  it('passes meta.next_token through as the cursor', async () => {
    stub({ data: [], meta: { next_token: 'NEXT1' } })
    const r = await new TwitterDistributor().listPosts('tok', undefined, 'U1')
    expect(r.nextCursor).toBe('NEXT1')
  })
})

describe('BlueskyDistributor.listPosts', () => {
  /**
   * Shape below is copied from a LIVE app.bsky.feed.getAuthorFeed response
   * (2026-09-23), not invented. Bluesky's appview needs no auth at all, which
   * is why this is the cheapest end-to-end proof of the native-history chain.
   */
  const liveShape = (over: Record<string, unknown> = {}) => ({
    post: {
      uri: 'at://did:plc:abc/app.bsky.feed.post/3mw2cdr44fc2a',
      author: { handle: 'lockelum.bsky.social' },
      record: { text: 'hello world', createdAt: '2026-09-21T18:04:06.128Z' },
      likeCount: 638, replyCount: 76, repostCount: 76, quoteCount: 45,
      ...over,
    },
  })

  it('maps a live-shaped feed item, building the web URL from the rkey', async () => {
    stub({ feed: [liveShape()], cursor: 'CUR1' })
    const r = await new BlueskyDistributor().listPosts('{"identifier":"a","password":"b"}')
    expect(r.posts[0].platformPostId).toBe('at://did:plc:abc/app.bsky.feed.post/3mw2cdr44fc2a')
    expect(r.posts[0].platformPostUrl).toBe(
      'https://bsky.app/profile/lockelum.bsky.social/post/3mw2cdr44fc2a'
    )
    expect(r.posts[0].content).toBe('hello world')
    expect(r.posts[0].metrics).toEqual({ likes: 638, comments: 76, shares: 76, quotes: 45 })
    expect(r.nextCursor).toBe('CUR1')
  })

  /**
   * A repost is someone ELSE's words. Including it would poison a client's
   * brand-voice history with another account's writing.
   */
  it('excludes reposts', async () => {
    stub({ feed: [{ ...liveShape(), reason: { $type: 'app.bsky.feed.defs#reasonRepost' } }] })
    const r = await new BlueskyDistributor().listPosts('{"identifier":"a","password":"b"}')
    expect(r.posts).toHaveLength(0)
  })

  it('falls back to the stored identifier when no accountId is given', async () => {
    const f = vi.fn().mockResolvedValue({
      status: 200, ok: true, headers: new Headers(), json: async () => ({ feed: [] }),
    })
    vi.stubGlobal('fetch', f)
    await new BlueskyDistributor().listPosts('{"identifier":"lockelum.bsky.social","password":"x"}')
    expect(f.mock.calls[0][0]).toContain('actor=lockelum.bsky.social')
  })

  it('accepts an explicit DID as the actor', async () => {
    const f = vi.fn().mockResolvedValue({
      status: 200, ok: true, headers: new Headers(), json: async () => ({ feed: [] }),
    })
    vi.stubGlobal('fetch', f)
    await new BlueskyDistributor().listPosts('{}', undefined, 'did%3Aplc%3Aabc')
    expect(f.mock.calls[0][0]).toContain('actor=did')
  })

  // Sending "undefined" as an actor yields a confusing 400 instead of a clear cause.
  it('throws when no actor can be determined', async () => {
    await expect(new BlueskyDistributor().listPosts('not-json')).rejects.toBeInstanceOf(
      NativeHistoryUnsupportedError
    )
  })

  it('returns no cursor on the final page', async () => {
    stub({ feed: [liveShape()] })
    const r = await new BlueskyDistributor().listPosts('{"identifier":"a","password":"b"}')
    expect(r.nextCursor).toBeUndefined()
  })

  // An empty feed is a VALID answer — the live LockeLum account returns exactly
  // this today. It must not be confused with an error.
  it('returns an empty list, not an error, for an account with no posts', async () => {
    stub({ feed: [] })
    const r = await new BlueskyDistributor().listPosts('{"identifier":"a","password":"b"}')
    expect(r.posts).toEqual([])
  })

  it('throws on a provider error rather than reporting empty history', async () => {
    stub({ error: 'InvalidRequest' }, 400)
    await expect(
      new BlueskyDistributor().listPosts('{"identifier":"a","password":"b"}')
    ).rejects.toThrow(/400/)
  })
})
