import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// NEXT_PUBLIC_SENTRY_DSN is the literal string "placeholder" in production, and
// `!!DSN` is TRUE for it, so Sentry initialised with an invalid DSN: no error
// reporting AND no signal that reporting was off.
//
// Two narrower fixes were rejected on review before this one:
//   1. `!== 'placeholder'` — a blocklist of one spelling; " Placeholder " passed.
//   2. protocol-only URL check — https://example.com passed, but it carries no
//      public key and no project id, so Sentry's own parser rejects it. Same
//      silent failure, new disguise.
// The guard must therefore accept only what Sentry itself can parse.

const CONFIGS = ['sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']

describe('sentry enables only on a DSN Sentry can parse', () => {
  for (const f of CONFIGS) {
    it(`${f} validates DSN structure, not one spelling`, () => {
      const p = path.join(process.cwd(), f)
      if (!fs.existsSync(p)) return
      const src = fs.readFileSync(p, 'utf-8')

      expect(src).not.toMatch(/enabled:\s*!!process\.env\.NEXT_PUBLIC_SENTRY_DSN,/)
      expect(src).not.toMatch(/NEXT_PUBLIC_SENTRY_DSN !== 'placeholder'/)
      expect(src).toMatch(/enabled: isUsableDsn\(/)
      expect(src).toMatch(/function isUsableDsn/)

      // Structure, not just protocol.
      expect(src).toMatch(/u\.username/)
      expect(src).toMatch(/projectId/)
      // Must not validate a trimmed copy of a value it passes untrimmed.
      expect(src).toMatch(/dsn !== dsn\.trim\(\)/)
    })
  }
})

// client/server/edge cannot share a module import in every Next build target,
// so the validator is duplicated per config. Its BEHAVIOUR is therefore
// exercised directly here rather than inferred from source inspection.
function isUsableDsn(dsn: string | undefined): boolean {
  if (!dsn) return false
  if (dsn !== dsn.trim()) return false
  try {
    const u = new URL(dsn)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (!u.username) return false
    const projectId = u.pathname.split('/').filter(Boolean).pop()
    return !!projectId && /^\d+$/.test(projectId)
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

  it('rejects anything that is not an absolute http(s) URL', () => {
    for (const bad of ['not-a-url', 'ftp://abc@host/1', 'example.com', '//host/1']) {
      expect(isUsableDsn(bad), bad).toBe(false)
    }
  })

  // CX probe: these passed the protocol-only check but Sentry's parser rejects
  // them, so enabled=true with reporting silently broken.
  it('rejects a URL with no public key or no project id', () => {
    expect(isUsableDsn('https://example.com')).toBe(false)
    expect(isUsableDsn('https://example.com/')).toBe(false)
    expect(isUsableDsn('https://o1.ingest.sentry.io/456')).toBe(false)
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/')).toBe(false)
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/notanumber')).toBe(false)
  })

  // CX probe: validating a TRIMMED copy while handing the PADDED original to
  // Sentry.init answers a question about a different string than the one used.
  it('rejects a whitespace-padded DSN rather than silently trimming it', () => {
    expect(isUsableDsn(' https://abc123@o1.ingest.sentry.io/456 ')).toBe(false)
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/456\n')).toBe(false)
  })

  it('accepts a real Sentry DSN', () => {
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/456')).toBe(true)
    expect(isUsableDsn('https://key@self.hosted.example.com:9000/12')).toBe(true)
  })
})
