import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * P0-1 — fan-out token/post pairing.
 *
 * fanOut() reads the post by id but was handed profileId and platforms as
 * separate event data, then selected tokens by that supplied profileId. An
 * in-memory probe dispatched post-B's content on profile-A's token. These
 * tests bind the (post, profile, platform) tuple to the post row.
 *
 * What would FAIL these tests: a guard placed after the token query, after the
 * `posting` status write, or after any provider call — every assertion below
 * counts side effects, not just the thrown error. Deleting
 * assertTupleMatches() makes the mismatch cases fail on effect count, and the
 * matching case proves the guard does not simply reject everything.
 */

const POST_B = {
  id: 'post-B',
  profile_id: 'profile-B',
  content: 'B-private-content',
  platforms: ['facebook'],
  media_urls: null,
}

// Every table touch and every write is recorded, so a test can assert that a
// rejected job performed no reads of oauth_tokens and no writes at all.
let queries: { table: string; filters: Record<string, unknown> }[]
let writes: { table: string; op: string; value: unknown }[]
let providerCalls: { token: string; content: string }[]

function makeDb() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      queries.push({ table, filters })
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters[k] = v
          return q
        },
        in: (k: string, v: unknown) => {
          filters[k] = v
          return q
        },
        single: async () => ({
          data:
            table === 'posts'
              ? filters.id === POST_B.id
                ? POST_B
                : null
              : { webhook_url: null },
          error: null,
        }),
        update: (v: unknown) => {
          writes.push({ table, op: 'update', value: v })
          return q
        },
        upsert: (v: unknown) => {
          writes.push({ table, op: 'upsert', value: v })
          return q
        },
        insert: (v: unknown) => {
          writes.push({ table, op: 'insert', value: v })
          return q
        },
        // Awaiting a filtered query (no .single()) resolves here.
        then: (resolve: (r: unknown) => unknown) =>
          resolve({
            data:
              table === 'oauth_tokens'
                ? [{ platform: 'facebook', access_token: `token-${filters.profile_id}` }]
                : [],
            error: null,
          }),
      }
      return q
    },
  }
}

vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return makeDb()
  },
}))

vi.mock('@/lib/crypto', () => ({
  decryptToken: async (t: string) => t,
}))

// The real Facebook distributor is replaced by one that records the token it
// was handed alongside the content it was asked to publish — that pairing is
// exactly what the defect corrupted.
vi.mock('@/distributors/facebook', () => ({
  FacebookDistributor: class {
    async post(payload: { content: string }, token: string) {
      providerCalls.push({ token, content: payload.content })
      return { success: true, platformPostId: 'fake-id' }
    }
  },
}))

beforeEach(() => {
  queries = []
  writes = []
  providerCalls = []
})

async function load() {
  return import('@/lib/fan-out')
}

describe('fanOut tuple binding — profile', () => {
  it('rejects a post belonging to another profile', async () => {
    const { fanOut, TupleMismatchError } = await load()
    await expect(fanOut('post-B', ['facebook'], 'profile-A')).rejects.toBeInstanceOf(
      TupleMismatchError
    )
  })

  it('names both the owning and the supplied profile so the failure is diagnosable', async () => {
    const { fanOut } = await load()
    await expect(fanOut('post-B', ['facebook'], 'profile-A')).rejects.toThrow(
      /profile-B.*profile-A/
    )
  })

  it('selects no tokens — the guard runs before credentials are read', async () => {
    const { fanOut } = await load()
    await fanOut('post-B', ['facebook'], 'profile-A').catch(() => {})
    expect(queries.filter((q) => q.table === 'oauth_tokens')).toHaveLength(0)
  })

  it('performs zero writes — no status change, no result row, no audit log', async () => {
    const { fanOut } = await load()
    await fanOut('post-B', ['facebook'], 'profile-A').catch(() => {})
    expect(writes).toEqual([])
  })

  it('makes zero provider calls', async () => {
    const { fanOut } = await load()
    await fanOut('post-B', ['facebook'], 'profile-A').catch(() => {})
    expect(providerCalls).toEqual([])
  })
})

describe('fanOut tuple binding — platform', () => {
  it('rejects a platform the post was not authored for', async () => {
    const { fanOut, TupleMismatchError } = await load()
    await expect(fanOut('post-B', ['twitter'], 'profile-B')).rejects.toBeInstanceOf(
      TupleMismatchError
    )
  })

  it('rejects the whole job when only one of several platforms is unauthorized', async () => {
    const { fanOut } = await load()
    await expect(fanOut('post-B', ['facebook', 'twitter'], 'profile-B')).rejects.toThrow(
      /twitter/
    )
    expect(writes).toEqual([])
    expect(providerCalls).toEqual([])
  })
})

describe('fanOut tuple binding — the matching case still works', () => {
  /**
   * Without this, a guard that rejected every job would pass every test above.
   */
  it('dispatches when profile and platform both match the post row', async () => {
    const { fanOut } = await load()
    const results = await fanOut('post-B', ['facebook'], 'profile-B')
    expect(results[0].success).toBe(true)
  })

  it('pairs the post content with its OWN profile token', async () => {
    const { fanOut } = await load()
    await fanOut('post-B', ['facebook'], 'profile-B')
    expect(providerCalls).toEqual([
      { token: 'token-profile-B', content: 'B-private-content' },
    ])
  })
})
