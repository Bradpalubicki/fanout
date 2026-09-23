import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * select-page GET returned Meta Graph page objects VERBATIM, having asked
 * Graph for `access_token` in the field list. Every Page access token the
 * connecting user manages was therefore serialized into an HTTP response to
 * the browser — a live, postable credential handed to the client for nothing.
 * Nothing consumed it: the picker renders id, name and picture, and POST
 * re-fetches the page token server-side before encrypting it.
 *
 * These tests assert on the RESPONSE BODY, not on the Graph query string, so
 * they hold even if Graph returns a field that was not requested. The
 * adversarial fixture below does exactly that: it returns access_token even
 * though the fixed code does not ask for it, which is what a field-projection
 * bug or a Graph default would look like.
 *
 * What would FAIL these tests: returning `data.data` directly again, adding
 * access_token back to the projection, or spreading the Graph object into the
 * response.
 */

const PAGE_TOKEN = 'EAAG-live-page-token-must-never-be-returned'

let graphResponses: Record<string, unknown>

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user_1', orgId: 'org_1' }),
}))

vi.mock('@/lib/crypto', () => ({
  decryptToken: async () => 'user-token',
  encryptToken: async (t: string) => `enc(${t})`,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: { id: 'profile-1' }, error: null }),
        single: async () =>
          table === 'oauth_tokens'
            ? { data: { access_token: 'enc', refresh_token: null, expires_at: null }, error: null }
            : { data: { id: 'profile-1' }, error: null },
      }
      return q
    },
  },
}))

beforeEach(() => {
  // Adversarial: Graph returns access_token on every page even though the
  // fixed code no longer asks for it. A correct handler still must not
  // forward it.
  graphResponses = {
    'me/accounts': {
      data: [
        {
          id: '111',
          name: 'Acme Page',
          access_token: PAGE_TOKEN,
          picture: { data: { url: 'https://img/1.jpg' } },
          category: 'Business',
        },
        {
          id: '222',
          name: 'Second Page',
          access_token: PAGE_TOKEN + '-2',
          instagram_business_account: { id: 'ig-1' },
        },
      ],
    },
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = Object.keys(graphResponses).find((k) => String(url).includes(k))
      const payload = key
        ? graphResponses[key]
        : { id: 'ig-1', username: 'acme', access_token: PAGE_TOKEN }
      return { ok: true, status: 200, json: async () => payload }
    })
  )
})

afterEach(() => vi.unstubAllGlobals())

function getReq(platform: string) {
  return {
    url: `https://fanout.digital/api/oauth/select-page?profileId=00000000-0000-0000-0000-000000000001&platform=${platform}`,
  } as never
}

describe('select-page GET — no page access token reaches the client', () => {
  for (const platform of ['facebook', 'instagram', 'threads']) {
    it(`does not serialize any access token for ${platform}`, async () => {
      const { GET } = await import('@/app/api/oauth/select-page/route')
      const res = await GET(getReq(platform))
      const raw = JSON.stringify(await res.json())
      expect(raw).not.toContain(PAGE_TOKEN)
      expect(raw).not.toContain('access_token')
    })
  }

  it('returns only id, name and picture for facebook pages', async () => {
    const { GET } = await import('@/app/api/oauth/select-page/route')
    const res = await GET(getReq('facebook'))
    const { pages } = (await res.json()) as { pages: Record<string, unknown>[] }
    // `picture` is absent when Graph returns no picture (undefined is dropped
    // by JSON), so assert the key set is a SUBSET of the allowed fields —
    // which is the property that matters: nothing else may appear.
    const allowed = new Set(['id', 'name', 'picture'])
    for (const page of pages) {
      expect(Object.keys(page).filter((k) => !allowed.has(k))).toEqual([])
      expect(page).toHaveProperty('id')
      expect(page).toHaveProperty('name')
    }
  })

  it('drops unrequested fields Graph volunteers, such as category', async () => {
    const { GET } = await import('@/app/api/oauth/select-page/route')
    const res = await GET(getReq('facebook'))
    expect(JSON.stringify(await res.json())).not.toContain('category')
  })

  // Without this, a handler returning {pages: []} would pass every test above.
  it('still returns the pages the picker needs to render', async () => {
    const { GET } = await import('@/app/api/oauth/select-page/route')
    const res = await GET(getReq('facebook'))
    const { pages } = (await res.json()) as { pages: { id: string; name: string }[] }
    expect(pages).toHaveLength(2)
    expect(pages[0]).toMatchObject({ id: '111', name: 'Acme Page' })
  })
})

describe('select-page — the Graph query itself does not request a page token', () => {
  /**
   * Defence in depth. Not requesting the credential is better than requesting
   * it and stripping it: a token never fetched cannot leak through a log, an
   * error path, or a future refactor of the projection.
   */
  it('omits access_token from the GET field list', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/oauth/select-page/route.ts'),
      'utf-8'
    )
    const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST'))
    // Match access_token only inside the `fields=` list — it stops at `&`, so
    // this does not match the `&access_token=` AUTH parameter, which every
    // Graph call legitimately carries.
    const requestedFields = [...get.matchAll(/fields=([^&`]*)/g)].map((m) => m[1])
    expect(requestedFields.length).toBeGreaterThan(0)
    expect(requestedFields.filter((f) => f.includes('access_token'))).toEqual([])
  })

  it('POST still fetches the page token server-side — the picker does not need it', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/oauth/select-page/route.ts'),
      'utf-8'
    )
    const post = src.slice(src.indexOf('export async function POST'))
    expect(post).toMatch(/fields=access_token,name/)
    expect(post).toMatch(/encryptToken\(finalToken\)/)
  })

  it('never interpolates a raw token into a Graph URL unencoded', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/oauth/select-page/route.ts'),
      'utf-8'
    )
    expect(src).not.toMatch(/access_token=\$\{userToken\}/)
    expect(src).not.toMatch(/fb_exchange_token=\$\{data\.access_token\}/)
  })
})
