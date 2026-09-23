import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { matchesBearerSecret, requireBearerSecret, requireCronAuth } from '@/lib/cron-auth'

/**
 * P0-3 — cron auth must fail CLOSED.
 *
 * Every cron route compared the header against `Bearer ${process.env.CRON_SECRET}`.
 * With the secret unset the template interpolates the string "undefined", so
 * the literal header `Bearer undefined` compared EQUAL and authorized an
 * anonymous caller. A probe with the secret missing returned 200 and
 * processed a post.
 *
 * Deployed state, checked 2026-09-23: CRON_SECRET is set on Production only.
 * So this was latent in production and LIVE on Preview and Development, which
 * are publicly reachable.
 *
 * What would FAIL these tests: restoring the template-literal comparison (the
 * `Bearer undefined` cases return authorized), or treating an empty-string
 * secret as configured (the empty case fires). The valid-secret cases prove
 * the guard does not simply reject everything.
 */

const ORIGINAL = { ...process.env }

function req(authHeader: string | null) {
  return { headers: { get: (n: string) => (n === 'authorization' ? authHeader : null) } }
}

beforeEach(() => {
  delete process.env.CRON_SECRET
  delete process.env.INTERNAL_API_KEY
})

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe('matchesBearerSecret — an unconfigured secret authorizes nobody', () => {
  // The exact header the old template literal produced a match for.
  it('rejects "Bearer undefined" when the secret is unset', () => {
    expect(matchesBearerSecret('Bearer undefined', undefined)).toBe(false)
  })

  it('rejects the literal string "undefined" as a secret value', () => {
    expect(matchesBearerSecret('Bearer undefined', 'undefined')).toBe(false)
  })

  it('rejects an empty-string secret', () => {
    expect(matchesBearerSecret('Bearer ', '')).toBe(false)
  })

  it('rejects a whitespace-only secret', () => {
    expect(matchesBearerSecret('Bearer    ', '   ')).toBe(false)
  })

  it('rejects a placeholder secret', () => {
    expect(matchesBearerSecret('Bearer placeholder', 'placeholder')).toBe(false)
  })

  it('rejects "Bearer null" against an unset secret', () => {
    expect(matchesBearerSecret('Bearer null', undefined)).toBe(false)
  })

  it('rejects a missing authorization header even with a valid secret', () => {
    expect(matchesBearerSecret(null, 's3cret')).toBe(false)
  })

  it('rejects a wrong secret', () => {
    expect(matchesBearerSecret('Bearer wrong', 's3cret')).toBe(false)
  })

  // Without this, a guard that returned false unconditionally would pass.
  it('accepts the correct secret when one is configured', () => {
    expect(matchesBearerSecret('Bearer s3cret', 's3cret')).toBe(true)
  })
})

describe('requireCronAuth — 401 when the secret is not configured', () => {
  it('returns 401 for "Bearer undefined" with CRON_SECRET unset', () => {
    const res = requireCronAuth(req('Bearer undefined'))
    expect(res?.status).toBe(401)
  })

  it('returns 401 for any request when CRON_SECRET is unset', () => {
    expect(requireCronAuth(req(null))?.status).toBe(401)
    expect(requireCronAuth(req('Bearer anything'))?.status).toBe(401)
  })

  it('authorizes (returns null) only with the configured secret', () => {
    process.env.CRON_SECRET = 'real-secret'
    expect(requireCronAuth(req('Bearer real-secret'))).toBeNull()
    expect(requireCronAuth(req('Bearer undefined'))?.status).toBe(401)
  })
})

describe('requireBearerSecret — multi-secret routes fail closed on BOTH', () => {
  /**
   * generate-social-content accepted CRON_SECRET OR INTERNAL_API_KEY. With
   * neither configured, `Bearer undefined` satisfied either branch.
   */
  it('returns 401 for "Bearer undefined" when neither secret is configured', () => {
    const res = requireBearerSecret(req('Bearer undefined'), [
      'CRON_SECRET',
      'INTERNAL_API_KEY',
    ])
    expect(res?.status).toBe(401)
  })

  it('still authorizes via the second secret when only that one is set', () => {
    process.env.INTERNAL_API_KEY = 'internal-key'
    expect(
      requireBearerSecret(req('Bearer internal-key'), ['CRON_SECRET', 'INTERNAL_API_KEY'])
    ).toBeNull()
  })

  it('does not let an unset first secret authorize a caller', () => {
    process.env.INTERNAL_API_KEY = 'internal-key'
    expect(
      requireBearerSecret(req('Bearer undefined'), ['CRON_SECRET', 'INTERNAL_API_KEY'])?.status
    ).toBe(401)
  })

  it('does not disclose whether the secret was missing or merely wrong', async () => {
    process.env.CRON_SECRET = 'real-secret'
    const wrong = await requireBearerSecret(req('Bearer wrong'), ['CRON_SECRET'])!.json()
    delete process.env.CRON_SECRET
    const missing = await requireBearerSecret(req('Bearer wrong'), ['CRON_SECRET'])!.json()
    expect(wrong).toEqual(missing)
  })
})

describe('no route reintroduces the fail-open comparison', () => {
  /**
   * The defect was a one-line idiom copy-pasted across six routes. Fixing the
   * six call sites does not stop a seventh from being written the same way, so
   * this scans the tree: the raw `Bearer ${process.env...}` comparison must
   * appear nowhere outside cron-auth.ts, where it survives only in the comment
   * documenting what went wrong.
   */
  const SRC = path.join(process.cwd(), 'src')

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) return walk(full)
      return e.isFile() && /\.tsx?$/.test(e.name) ? [full] : []
    })
  }

  it('no source file compares a header against an interpolated env secret', () => {
    const offenders = walk(SRC).filter((f) => {
      if (f.endsWith(path.join('lib', 'cron-auth.ts'))) return false
      const src = fs.readFileSync(f, 'utf-8')
      return /!==\s*`Bearer \$\{process\.env\./.test(src)
    })
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })

  it('every scheduled cron route in vercel.json uses the shared guard', () => {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8')
    ) as { crons: { path: string }[] }
    expect(cfg.crons.length).toBeGreaterThan(0)
    for (const { path: route } of cfg.crons) {
      const file = path.join(SRC, 'app', route, 'route.ts')
      expect(fs.existsSync(file), `${route} has no route.ts`).toBe(true)
      expect(fs.readFileSync(file, 'utf-8'), `${route} is not gated`).toMatch(
        /requireCronAuth\(req\)/
      )
    }
  })
})
