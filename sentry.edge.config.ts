import * as Sentry from '@sentry/nextjs'
import { makeDsn } from '@sentry/core'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  // A real DSN is an absolute http(s) URL. Matching the exact literal
  // "placeholder" left case and whitespace variants (" Placeholder ") enabling
  // Sentry with an invalid DSN again, which is the same silent failure: no
  // reporting AND no signal reporting is off. Validate the SHAPE instead of
  // blocklisting one spelling.
  enabled: isUsableDsn(process.env.NEXT_PUBLIC_SENTRY_DSN),
})

/**
 * True only for a DSN Sentry itself can parse.
 *
 * A protocol-only check was not enough: https://example.com passed it but has
 * no public key and no project id, so Sentry's own parser rejects it and
 * reporting silently does not work — the same invisible failure as the
 * placeholder. A Sentry DSN is
 *   <protocol>://<publicKey>@<host>[:port]/<path...>/<projectId>
 * so the key and a numeric-ish project id are both required.
 */
function isUsableDsn(dsn: string | undefined): boolean {
  if (!dsn) return false
  // Untrimmed is rejected BEFORE anything else. makeDsn accepts a trailing
  // newline and normalises it away, but Sentry.init receives the PADDED
  // original, so validating a trimmed copy would answer a question about a
  // different string than the one actually used.
  if (dsn !== dsn.trim()) return false

  // Parse with the SDK so this cannot drift from Sentry's own grammar (the
  // previous hand-rolled parser accepted `bad-key@...` and a trailing-slash
  // path, which Sentry then rejected — enabled=true with reporting silently
  // broken).
  let parsed: ReturnType<typeof makeDsn>
  try {
    parsed = makeDsn(dsn)
  } catch {
    return false
  }
  if (!parsed) return false

  // The SDK's structural validation is COMPILED OUT of release builds:
  // validateDsn() returns true immediately when DEBUG_BUILD is false, and
  // `disableLogger: true` in next.config.ts strips debug from production. So
  // delegation ALONE is stricter in dev and LOOSER in prod — it would accept
  // ftp:// and a non-numeric project id in the build that actually ships.
  // Found by CX 2026-09-28. These checks are therefore asserted here, on the
  // parsed components, independent of compilation mode.
  if (parsed.protocol !== 'http' && parsed.protocol !== 'https') return false
  if (!parsed.publicKey) return false
  if (!parsed.host) return false
  if (!/^\d+$/.test(parsed.projectId)) return false
  return true
}
