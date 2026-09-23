import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * P0-2 — DM replies must never reach a public transport.
 *
 * Every transport in sendPlatformReply() publishes publicly. Meta alone
 * rejected type 'dm'; the Twitter, YouTube and LinkedIn branches did not check
 * `type` at all, so a probe made one provider call each — a private message
 * published publicly.
 *
 * What would FAIL these tests: restoring the per-branch check on Meta only
 * (the other four platforms then make calls), moving the gate below token
 * decryption (the decrypt-count assertion fires), or widening the allowlist to
 * pass unknown types (the 'unknown type' case fires). The tests assert on
 * fetch calls and decrypt calls, not on the response body, so a route that
 * returns an error while still calling the provider does not pass.
 */

const PLATFORMS = ['facebook', 'instagram', 'twitter', 'youtube', 'linkedin']

let fetchCalls: string[]
let decryptCalls: number
let item: Record<string, unknown>
let updates: unknown[]

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user_1', orgId: 'org_1' }),
}))

vi.mock('@/lib/crypto', () => ({
  decryptToken: async (t: string) => {
    decryptCalls++
    return `plain-${t}`
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        update: (v: unknown) => {
          updates.push({ table, value: v })
          return q
        },
        single: async () =>
          table === 'inbox_items'
            ? { data: item, error: null }
            : { data: { access_token: 'enc', platform_page_id: null }, error: null },
      }
      return q
    },
  },
}))

beforeEach(() => {
  fetchCalls = []
  decryptCalls = 0
  updates = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetchCalls.push(String(url))
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
    })
  )
})

function req(body: unknown) {
  return { json: async () => body } as never
}

function inboxItem(platform: string, type: string) {
  return {
    id: 'item-1',
    profile_id: 'profile-1',
    platform,
    type,
    post_url: null,
    platform_item_id: 'pid-1',
    profiles: { org_id: 'org_1' },
  }
}

describe('inbox reply — type dm never reaches a public transport', () => {
  for (const platform of PLATFORMS) {
    it(`makes zero provider calls for a dm on ${platform}`, async () => {
      item = inboxItem(platform, 'dm')
      const { PATCH } = await import('@/app/api/dashboard/inbox/route')
      await PATCH(req({ id: 'item-1', reply: 'hello' }))
      expect(fetchCalls).toEqual([])
    })

    it(`never marks a dm on ${platform} as replied`, async () => {
      item = inboxItem(platform, 'dm')
      const { PATCH } = await import('@/app/api/dashboard/inbox/route')
      await PATCH(req({ id: 'item-1', reply: 'hello' }))
      expect(updates).toEqual([])
    })
  }

  it('does not even decrypt a token for a reply it will refuse', async () => {
    item = inboxItem('twitter', 'dm')
    const { PATCH } = await import('@/app/api/dashboard/inbox/route')
    await PATCH(req({ id: 'item-1', reply: 'hello' }))
    expect(decryptCalls).toBe(0)
  })

  it('names the type in the error so the operator knows why', async () => {
    item = inboxItem('linkedin', 'dm')
    const { PATCH } = await import('@/app/api/dashboard/inbox/route')
    const res = await PATCH(req({ id: 'item-1', reply: 'hello' }))
    expect((await res.json()).detail).toMatch(/dm/)
  })
})

describe('inbox reply — unknown types are refused by default, not published', () => {
  /**
   * The allowlist is the point: a type nobody has thought of yet (a review, a
   * private story reply) must not be published merely because no branch
   * happened to exclude it.
   */
  for (const type of ['message', 'private_reply', 'review', 'story_reply', '']) {
    it(`makes zero provider calls for unknown type '${type}'`, async () => {
      item = inboxItem('twitter', type)
      const { PATCH } = await import('@/app/api/dashboard/inbox/route')
      await PATCH(req({ id: 'item-1', reply: 'hello' }))
      expect(fetchCalls).toEqual([])
    })
  }
})

describe('inbox reply — public types still work', () => {
  /**
   * Without this, a gate that refused everything would pass every test above.
   */
  for (const platform of PLATFORMS) {
    it(`still delivers a comment reply on ${platform}`, async () => {
      item = inboxItem(platform, 'comment')
      const { PATCH } = await import('@/app/api/dashboard/inbox/route')
      await PATCH(req({ id: 'item-1', reply: 'hello' }))
      expect(fetchCalls).toHaveLength(1)
    })
  }

  it('still delivers a mention reply', async () => {
    item = inboxItem('twitter', 'mention')
    const { PATCH } = await import('@/app/api/dashboard/inbox/route')
    await PATCH(req({ id: 'item-1', reply: 'hello' }))
    expect(fetchCalls).toHaveLength(1)
  })

  it('marks a delivered comment reply as replied', async () => {
    item = inboxItem('twitter', 'comment')
    const { PATCH } = await import('@/app/api/dashboard/inbox/route')
    await PATCH(req({ id: 'item-1', reply: 'hello' }))
    expect(updates).toHaveLength(1)
  })
})
