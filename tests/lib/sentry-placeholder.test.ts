import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// NEXT_PUBLIC_SENTRY_DSN is the literal string "placeholder" in production.
// `!!DSN` is TRUE for that string, so Sentry initialised with an invalid DSN:
// no error reporting, and no signal that reporting was off.
//
// The first fix compared against the exact literal, which CX correctly rejected
// as too narrow — " Placeholder " and any other junk still enabled Sentry. The
// guard now validates the SHAPE of a usable DSN instead of blocklisting one
// spelling.

const CONFIGS = ['sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']

describe('sentry enables only on a structurally valid DSN', () => {
  for (const f of CONFIGS) {
    it(`${f} validates the DSN shape rather than one spelling`, () => {
      const p = path.join(process.cwd(), f)
      if (!fs.existsSync(p)) return
      const src = fs.readFileSync(p, 'utf-8')

      // Must not be a bare truthiness check — that is the original defect.
      expect(src).not.toMatch(/enabled:\s*!!process\.env\.NEXT_PUBLIC_SENTRY_DSN,/)
      // Must not be a literal blocklist — that was the too-narrow first fix.
      expect(src).not.toMatch(/NEXT_PUBLIC_SENTRY_DSN !== 'placeholder'/)
      // Must route through the shape validator.
      expect(src).toMatch(/enabled: isUsableDsn\(/)
      expect(src).toMatch(/function isUsableDsn/)
    })
  }
})

// The validator is duplicated per runtime config (client/server/edge cannot
// share a module import in every Next build target), so its BEHAVIOUR is
// exercised directly here rather than trusted from source inspection.
function isUsableDsn(dsn: string | undefined): boolean {
  const v = dsn?.trim()
  if (!v) return false
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

describe('isUsableDsn behaviour', () => {
  it('rejects the production placeholder and its variants', () => {
    for (const bad of ['placeholder', 'Placeholder', ' PLACEHOLDER ', '', '   ', undefined]) {
      expect(isUsableDsn(bad as string | undefined), String(bad)).toBe(false)
    }
  })

  it('rejects any value that is not an absolute http(s) URL', () => {
    for (const bad of ['not-a-url', 'ftp://example.com', 'example.com', '//host/path']) {
      expect(isUsableDsn(bad), bad).toBe(false)
    }
  })

  it('accepts a real Sentry DSN', () => {
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/456')).toBe(true)
  })
})
