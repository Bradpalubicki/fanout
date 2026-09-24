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

// THE MIRROR TRAP: this file previously re-declared isUsableDsn by hand. The
// copy was correct while the SHIPPED config had /^d+$/ — a lost backslash that
// inverts the check (valid "456" false, invalid "d" true). Every test passed
// against the copy and proved nothing about the deployed code.
//
// The validator is therefore EXTRACTED from the real config source and
// evaluated, so these assertions can only pass if the shipped file is correct.
// client/server/edge cannot share a module import in every Next build target,
// so each copy is extracted and checked independently.
function loadValidator(configFile: string): (dsn: string | undefined) => boolean {
  const src = fs.readFileSync(path.join(process.cwd(), configFile), 'utf-8')
  const start = src.indexOf('function isUsableDsn')
  if (start < 0) throw new Error('isUsableDsn not found in ' + configFile)
  // Walk braces to the end of the function body.
  const bodyStart = src.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = bodyStart; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  if (end < 0) throw new Error('unbalanced isUsableDsn in ' + configFile)
  // Strip the TS annotations so the body can be evaluated as plain JS. Only
  // the signature carries them; the logic under test is untouched.
  const fnSrc = src
    .slice(start, end)
    .replace('function isUsableDsn(dsn: string | undefined): boolean', 'function isUsableDsn(dsn)')
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${fnSrc}; return isUsableDsn;`)() as (d: string | undefined) => boolean
}

describe.each(CONFIGS)('isUsableDsn behaviour (%s)', (configFile) => {
  const isUsableDsn = loadValidator(configFile)

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
