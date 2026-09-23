import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = path.join(process.cwd(), 'src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf-8')

/**
 * CX (2026-09-23) reproduced sibling-profile access by executing the real
 * handlers against mocked dependencies: an A-profile principal, adapted to keep
 * the dashboard's org check, listed B's inbox and replied THROUGH B's token.
 *
 * These are structural guards for the specific defects fixed in response. The
 * behavioural A/B/C probe belongs on each ported v1 route as it is built:
 *
 *   A's key vs A's resource      -> succeeds
 *   A's key vs sibling B (same org) -> discloses nothing, causes no effect
 *   A's key vs foreign-org C     -> discloses nothing, causes no effect
 *
 * Until that holds for a route, that route does not ship.
 */

describe('biolink clicksFor — caller-supplied id must be ownership-checked', () => {
  const src = read('app/api/dashboard/biolink/route.ts')

  // It queried biolink_clicks by a raw caller-supplied page_id and returned
  // another tenant's click counts. Live cross-tenant read, not a migration risk.
  it('verifies the page belongs to the caller before reading its clicks', () => {
    const idx = src.indexOf("get('clicksFor')")
    expect(idx).toBeGreaterThan(-1)
    const afterLookup = src.slice(idx, src.indexOf("from('biolink_clicks')"))
    expect(afterLookup).toMatch(/ownsPage|some\(|includes\(/)
  })

  it('returns 404 rather than empty data when the page is not owned', () => {
    const idx = src.indexOf('ownsPage')
    expect(idx).toBeGreaterThan(-1)
    expect(src.slice(idx, idx + 220)).toMatch(/status: 404/)
  })
})

describe('inbox reply — a private message must never publish publicly', () => {
  const src = read('app/api/dashboard/inbox/route.ts')

  /**
   * Every transport here publishes PUBLICLY. This used to be a per-branch
   * check on the Meta branch alone, which is why Twitter, YouTube and LinkedIn
   * published DMs — so this test no longer greps that branch. The gate is now
   * a single allowlist applied above every transport.
   *
   * Behavioural coverage (zero provider calls per platform, unknown types
   * refused, tokens not decrypted for a refused reply) lives in
   * tests/security/inbox-dm-public-transport.test.ts. This test only pins the
   * STRUCTURE: an allowlist, not a denylist, so a type nobody anticipated is
   * refused by default rather than published by default.
   */
  it('gates reply types with an allowlist, not a per-branch denylist', () => {
    expect(src).toMatch(/PUBLIC_REPLYABLE_TYPES\s*=\s*new Set\(\[\s*'comment',\s*'mention'\s*\]\)/)
    expect(src).toMatch(/if \(!PUBLIC_REPLYABLE_TYPES\.has\(type\)\) throw/)
  })

  it('applies the gate above the transports, not inside one branch', () => {
    const fn = src.slice(src.indexOf('async function sendPlatformReply'))
    const gateAt = fn.indexOf('assertPubliclyReplyable(type, platform)')
    const firstBranchAt = fn.indexOf("if (platform === 'facebook'")
    expect(gateAt).toBeGreaterThan(-1)
    expect(gateAt).toBeLessThan(firstBranchAt)
  })

  it('refuses before a credential is decrypted, not after', () => {
    const patch = src.slice(src.indexOf('export async function PATCH'))
    expect(patch.indexOf('assertPubliclyReplyable')).toBeLessThan(patch.indexOf('decryptToken('))
  })

  it('names the Messages API as the correct path rather than failing silently', () => {
    expect(src).toMatch(/Messages API, which is not implemented/)
  })
})

describe('analytics snapshots — cumulative rows must not be summed or picked at random', () => {
  /**
   * Snapshots are cumulative platform totals collected nightly, not deltas.
   * v1 read [0] with no ordering (an arbitrary row); mobile summed every row,
   * so totals grew each night with no new engagement.
   */
  it('v1 orders snapshots so [0] means latest', () => {
    const src = read('app/api/v1/analytics/[postId]/route.ts')
    expect(src).toMatch(/\.order\(\s*'collected_at'/)
    expect(src).toMatch(/referencedTable: 'analytics_snapshots'/)
    expect(src).toMatch(/ascending: false/)
  })

  it('mobile keeps only the newest snapshot per result instead of summing all', () => {
    const src = read('app/api/mobile/analytics/route.ts')
    expect(src).toMatch(/latestByResult/)
    // Flattened rather than using the `s` flag — tsconfig targets ES2017.
    expect(src.replace(/\n/g, ' ')).toMatch(/\.order\(\s*'collected_at'[^)]*ascending: false/)
    const reduceIdx = src.indexOf('totalImpressions')
    expect(src.slice(0, reduceIdx)).toMatch(/allSnapshots = \[\.\.\.latestByResult\.values\(\)\]/)
  })
})

describe('v1 routes bind resources to the verified profile, not the org', () => {
  /**
   * The correct pattern, which every ported route must follow: constrain the
   * resource by BOTH its id AND the key's profile before reading descendants.
   * Deriving org authority from a profile key grants access to sibling clients.
   */
  it('v1 analytics scopes the post by the key profile', () => {
    const src = read('app/api/v1/analytics/[postId]/route.ts')
    const beforeResults = src.slice(0, src.indexOf("from('post_results')"))
    expect(beforeResults).toMatch(/profile_id/)
  })

  it('no v1 route derives an org-wide profile list from the key', () => {
    const dir = path.join(SRC, 'app', 'api', 'v1')
    const files: string[] = []
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name === 'route.ts') files.push(p)
      }
    }
    walk(dir)
    expect(files.length).toBeGreaterThan(5)

    for (const f of files) {
      const src = fs.readFileSync(f, 'utf-8')
      // Fanning out across an org from a profile key is the sibling-access bug.
      const fansOutByOrg = /from\('profiles'\)[\s\S]{0,200}\.eq\('org_id'/.test(src)
      expect(fansOutByOrg, `${path.relative(SRC, f)} fans out across the org from a profile key`).toBe(false)
    }
  })
})
