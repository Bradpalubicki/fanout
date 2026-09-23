import { NextResponse } from 'next/server'

/**
 * Shared bearer-secret check for cron and internal routes.
 *
 * The defect this exists to prevent: every caller wrote
 *
 *   if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
 *
 * When CRON_SECRET is unset, the template literal interpolates the string
 * "undefined", so the header `Bearer undefined` compares EQUAL and the route
 * authorizes an anonymous caller. A probe with the secret missing returned
 * 200 and processed a post. CRON_SECRET is set on Production but not on
 * Preview or Development, so this was latent in production and live on every
 * preview deployment — which is publicly reachable.
 *
 * Five cron routes and generate-social-content shared the same line, so the
 * check lives here once rather than being fixed one call site at a time.
 */

/** Sentinel values a missing or placeholder secret collapses to. */
const INVALID_SECRETS = new Set(['', 'undefined', 'null', 'placeholder'])

function isUsableSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && !INVALID_SECRETS.has(secret.trim())
}

/**
 * True only when the secret is actually configured AND the header matches it.
 * An unconfigured secret can never authorize anyone — it fails CLOSED.
 */
export function matchesBearerSecret(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!isUsableSecret(secret)) return false
  if (!authHeader) return false
  return authHeader === `Bearer ${secret}`
}

/**
 * Returns a 401 response when the request is not authorized, or null when it
 * is. Callers do `const denied = requireCronAuth(req); if (denied) return denied`.
 *
 * `accept` lists the env var names any one of which may authorize the call.
 * A route whose secrets are all unconfigured returns 401 for every request,
 * including one presenting `Bearer undefined`.
 */
export function requireBearerSecret(
  req: { headers: { get(name: string): string | null } },
  accept: readonly string[]
): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const authorized = accept.some((name) => matchesBearerSecret(authHeader, process.env[name]))
  if (authorized) return null

  // Deliberately does not say whether the secret was missing or merely wrong:
  // that difference tells an unauthenticated caller how the route is configured.
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** Cron routes: authorized by CRON_SECRET alone. */
export function requireCronAuth(req: {
  headers: { get(name: string): string | null }
}): NextResponse | null {
  return requireBearerSecret(req, ['CRON_SECRET'])
}
