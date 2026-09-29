import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { makeDsn } from '@sentry/core'

// NEXT_PUBLIC_SENTRY_DSN is the literal string "placeholder" in production, and
// `!!DSN` is TRUE for it, so Sentry initialised with an invalid DSN: no error
// reporting AND no signal that reporting was off.
//
// Three narrower fixes were rejected on review before this one:
//   1. `!== 'placeholder'` — a blocklist of one spelling; " Placeholder " passed.
//   2. protocol-only URL check — https://example.com passed, but it carries no
//      public key and no project id, so Sentry's own parser rejects it. Same
//      silent failure, new disguise.
//   3. a HAND-ROLLED structural parse (username + numeric project id + trim).
//      CX proved on 2026-09-28 that it drifted from the SDK in both directions:
//      it accepted `https://bad-key@o1.ingest.sentry.io/456` and
//      `https://abc123@o1.ingest.sentry.io/456/`, both of which Sentry.init
//      rejects — enabled=true with reporting silently broken, again.
// The guard now DELEGATES to the SDK parser, so it cannot drift from it.

const CONFIGS = ['sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']

describe('sentry enables only on a DSN Sentry can parse', () => {
  for (const f of CONFIGS) {
    it(`${f} delegates validation to the SDK parser`, () => {
      const p = path.join(process.cwd(), f)
      if (!fs.existsSync(p)) return
      const src = fs.readFileSync(p, 'utf-8')

      expect(src).not.toMatch(/enabled:\s*!!process\.env\.NEXT_PUBLIC_SENTRY_DSN,/)
      expect(src).not.toMatch(/NEXT_PUBLIC_SENTRY_DSN !== 'placeholder'/)
      expect(src).toMatch(/enabled: isUsableDsn\(/)
      expect(src).toMatch(/function isUsableDsn/)

      // MUST delegate. Asserting the old implementation's internals
      // (u.username, the numeric-project-id regex) pinned a drifting
      // hand-rolled parser in place and is exactly what let fix 3 ship.
      expect(src).toMatch(/makeDsn/)
      expect(src).toMatch(/@sentry\/core/)
      // And must not regress to re-implementing the parse by hand.
      expect(src).not.toMatch(/u\.username/)
      expect(src).not.toMatch(/pathname\.split/)
    })
  }
})

// THE MIRROR TRAP: this file previously re-declared isUsableDsn by hand, and the
// hand-copy was CORRECT while all three shipped configs carried an inverted
// digit-class regex. Eight green tests never noticed (469d2b9). A mirror only
// tests itself.
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
    else if (c === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) throw new Error('unbalanced isUsableDsn in ' + configFile)
  // Strip the TS annotations so the body can be evaluated as plain JS. Only
  // the signature carries them; the logic under test is untouched.
  const fnSrc = src
    .slice(start, end)
    .replace('function isUsableDsn(dsn: string | undefined): boolean', 'function isUsableDsn(dsn)')
  // The extracted body calls makeDsn, so the REAL SDK function is injected into
  // the eval scope. Injecting the genuine parser keeps this a test of the
  // shipped file's behaviour; a local stand-in would recreate the mirror trap.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('makeDsn', `${fnSrc}; return isUsableDsn;`)(makeDsn) as (
    d: string | undefined
  ) => boolean
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

  // The two counterexamples that proved the hand-rolled parser had drifted.
  // Both were accepted by the old guard and are rejected by Sentry itself.
  it('agrees with the SDK on the DSNs that exposed the drift', () => {
    expect(isUsableDsn('https://bad-key@o1.ingest.sentry.io/456')).toBe(false)
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/456/')).toBe(false)
  })

  it('accepts a real Sentry DSN', () => {
    expect(isUsableDsn('https://abc123@o1.ingest.sentry.io/456')).toBe(true)
    expect(isUsableDsn('https://key@self.hosted.example.com:9000/12')).toBe(true)
  })

  // The guard must never be MORE PERMISSIVE than the parser that actually runs.
  // It is deliberately STRICTER in exactly one place: makeDsn accepts a
  // trailing-newline DSN, and Sentry.init would receive that padded string, so
  // the guard rejects untrimmed input before delegating. Padded values are
  // therefore excluded from this equivalence probe and asserted above instead.
  it('never disagrees with makeDsn on any probed value', () => {
    const probes = [
      'https://abc123@o1.ingest.sentry.io/456',
      'https://bad-key@o1.ingest.sentry.io/456',
      'https://abc123@o1.ingest.sentry.io/456/',
      'https://key@self.hosted.example.com:9000/12',
      'https://example.com',
      'https://o1.ingest.sentry.io/456',
      'placeholder',
      'not-a-url',
      'ftp://abc@host/1',
    ]
    for (const d of probes) {
      let sdkAccepts: boolean
      try {
        sdkAccepts = !!makeDsn(d)
      } catch {
        sdkAccepts = false
      }
      // One-directional: the guard may reject what the SDK accepts, never the reverse.
      if (!sdkAccepts) {
        expect(isUsableDsn(d), `guard accepts what the SDK rejects: ${d}`).toBe(false)
      }
      expect(isUsableDsn(d.trim()), `guard and SDK disagree on ${d}`).toBe(sdkAccepts)
    }
  })
})
