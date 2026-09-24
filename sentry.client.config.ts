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

/** True only for a syntactically usable Sentry DSN (absolute http/https URL). */
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
