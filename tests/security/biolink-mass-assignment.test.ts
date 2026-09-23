import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * biolink PATCH destructured `{ id, ...rest }` from the raw body and passed
 * `rest` straight into .update(), bypassing POST's pageSchema entirely.
 * Ownership WAS verified, so this was not cross-tenant — but a caller could
 * set any column on their own row, including `profile_id` (reassigning the
 * page to a different profile) and `created_at`.
 *
 * These tests assert on what reaches .update(), not on the status code, so a
 * handler that returns 200 while still writing a forbidden column fails.
 *
 * What would FAIL these tests: restoring the `...rest` spread, dropping
 * .strict() from the schema (unknown keys then pass silently), or adding
 * profile_id / id to the allowlist.
 */

let updatePayloads: unknown[]
let ownerOrgId: string

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'user_1', orgId: 'org_1' }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        update: (v: unknown) => {
          updatePayloads.push(v)
          return q
        },
        single: async () =>
          table === 'biolink_pages'
            ? { data: { id: 'page-1', profiles: { org_id: ownerOrgId } }, error: null }
            : { data: null, error: null },
      }
      return q
    },
  },
}))

beforeEach(() => {
  updatePayloads = []
  ownerOrgId = 'org_1'
})

function req(body: unknown) {
  return { json: async () => body } as never
}

const VALID = { id: 'page-1', title: 'My Page' }

describe('biolink PATCH — columns outside the allowlist never reach update()', () => {
  for (const [field, value] of [
    ['profile_id', 'page-other'],
    ['created_at', '1970-01-01T00:00:00Z'],
    ['org_id', 'org_2'],
    ['view_count', 999999],
  ] as const) {
    it(`rejects the request rather than writing '${field}'`, async () => {
      const { PATCH } = await import('@/app/api/dashboard/biolink/route')
      const res = await PATCH(req({ ...VALID, [field]: value }))
      expect(res.status).toBe(422)
      expect(updatePayloads).toEqual([])
    })
  }

  it('cannot reassign the page to another profile', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    await PATCH(req({ ...VALID, profile_id: 'other-profile' }))
    const written = JSON.stringify(updatePayloads)
    expect(written).not.toContain('profile_id')
    expect(written).not.toContain('other-profile')
  })

  it('never writes the id column even on an otherwise valid request', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    await PATCH(req(VALID))
    for (const payload of updatePayloads) {
      expect(Object.keys(payload as object)).not.toContain('id')
    }
  })
})

describe('biolink PATCH — the editor still works', () => {
  /**
   * Without this, a handler that rejected everything would pass every test
   * above. These are exactly the fields src/app/dashboard/biolink/page.tsx
   * sends on save.
   */
  const EDITOR_BODY = {
    id: 'page-1',
    title: 'My Page',
    bio: 'hello',
    background_color: '#fff',
    button_style: 'pill' as const,
    links: [{ title: 'Site', url: 'https://example.com' }],
    is_published: true,
  }

  it('accepts the exact body the editor sends', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    const res = await PATCH(req(EDITOR_BODY))
    expect(res.status).not.toBe(422)
    expect(updatePayloads).toHaveLength(1)
  })

  it('writes every editable field the editor changed', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    await PATCH(req(EDITOR_BODY))
    expect(updatePayloads[0]).toEqual({
      title: 'My Page',
      bio: 'hello',
      background_color: '#fff',
      button_style: 'pill',
      links: [{ title: 'Site', url: 'https://example.com' }],
      is_published: true,
    })
  })

  it('supports a partial update without requiring every field', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    await PATCH(req({ id: VALID.id, is_published: false }))
    expect(updatePayloads[0]).toEqual({ is_published: false })
  })

  it('rejects an update with no updatable fields rather than writing {}', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    const res = await PATCH(req({ id: VALID.id }))
    expect(res.status).toBe(400)
    expect(updatePayloads).toEqual([])
  })

  it('still validates field CONTENT, not just field names', async () => {
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    const res = await PATCH(req({ ...VALID, links: [{ title: 'x', url: 'not-a-url' }] }))
    expect(res.status).toBe(422)
    expect(updatePayloads).toEqual([])
  })
})

describe('biolink PATCH — ownership is still enforced', () => {
  it('returns 404 for a page belonging to another org, and writes nothing', async () => {
    ownerOrgId = 'org_2'
    const { PATCH } = await import('@/app/api/dashboard/biolink/route')
    const res = await PATCH(req(VALID))
    expect(res.status).toBe(404)
    expect(updatePayloads).toEqual([])
  })
})
