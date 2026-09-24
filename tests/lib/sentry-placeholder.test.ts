import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// NEXT_PUBLIC_SENTRY_DSN is the literal string "placeholder" in production.
// `!!DSN` is TRUE for that string, so Sentry initialised with an invalid DSN:
// no error reporting, and no signal that reporting was off. The guard must
// treat the placeholder as unset — the same rule integration-status.ts uses.

const CONFIGS = ['sentry.client.config.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts']

describe('sentry does not enable itself on a placeholder DSN', () => {
  for (const f of CONFIGS) {
    it(`${f} excludes the placeholder value`, () => {
      const p = path.join(process.cwd(), f)
      if (!fs.existsSync(p)) return
      const src = fs.readFileSync(p, 'utf-8')
      expect(src).toMatch(/enabled:/)
      expect(src, `${f} must not enable on a bare truthiness check`).toMatch(
        /NEXT_PUBLIC_SENTRY_DSN !== 'placeholder'/
      )
    })
  }
})
