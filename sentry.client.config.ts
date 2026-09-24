import * as Sentry from '@sentry/nextjs'

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
  // Compared AND passed untrimmed: validating a trimmed copy while handing the
  // padded original to Sentry.init means the check answers a question about a
  // different string than the one that is actually used.
  if (dsn !== dsn.trim()) return false
  try {
    const u = new URL(dsn)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (!u.username) return false
    const projectId = u.pathname.split('/').filter(Boolean).pop()
    return !!projectId && /^d+$/.test(projectId)
  } catch {
    return false
  }
}
