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
  // Delegate to the SDK PARSER rather than re-implementing it. A hand-rolled
  // check drifted from Sentry in both directions (CX audit 2026-09-28): it
  // accepted `bad-key@...` (the SDK requires a 32-hex public key) and a
  // trailing-slash path, both of which Sentry.init would then reject at runtime,
  // leaving Sentry silently disabled while the guard reported the DSN usable.
  // makeDsn signals rejection by RETURNING UNDEFINED, not by throwing, so the
  // return value is what must be tested. It also rejects untrimmed, non-http
  // and placeholder values, which the previous branches handled by hand.
  // Untrimmed is rejected BEFORE delegating. makeDsn accepts a trailing
  // newline (verified 2026-09-28), and Sentry.init receives the PADDED original,
  // so validating a trimmed copy would answer a question about a different
  // string than the one actually used. Delegation alone is not sufficient here.
  if (dsn !== dsn.trim()) return false
  try {
    return !!makeDsn(dsn)
  } catch {
    return false
  }
}
