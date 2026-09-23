#!/usr/bin/env node
/**
 * Inngest fleet health check.
 *
 * WHY THIS EXISTS
 * On 2026-09-23 every NuStack engine had a stale INNGEST_SIGNING_KEY. Inngest
 * accepted events (the EVENT key was fine) but could not invoke a single
 * function, so background jobs silently stopped across the whole portfolio and
 * stayed dead for months. In Fanout the visible symptom was a post that said
 * "Post queued!" and then sat at Pending forever with no error recorded
 * anywhere — the worst kind of failure, because every surface looked healthy.
 *
 * A GET to /api/inngest reports has_signing_key: true even when that key is
 * REJECTED — presence is not validity. Only a PUT actually exercises it.
 * That is the whole point of this check.
 *
 * Usage:  node scripts/check-inngest-health.mjs
 * Exit:   0 = all healthy, 1 = at least one engine is broken.
 */

const ENGINES = [
  { name: 'fanout', url: 'https://fanout.digital/api/inngest' },
  { name: 'certusaudit', url: 'https://certusaudit.co/api/inngest' },
  { name: 'agency-engine', url: 'https://nustack-agency-engine.vercel.app/api/inngest' },
  { name: 'wellness-engine', url: 'https://wellness-engine.vercel.app/api/inngest' },
  { name: 'marketing-engine', url: 'https://marketing-engine-roan.vercel.app/api/inngest' },
]

const TIMEOUT_MS = 25_000

async function check({ name, url }) {
  // PUT is the registration/sync call. It is the ONLY request that verifies the
  // signing key end to end; GET reports key presence, which proved worthless.
  let res
  try {
    res = await fetch(url, { method: 'PUT', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (err) {
    return { name, ok: false, status: 'unreachable', detail: String(err.message ?? err) }
  }

  const body = await res.json().catch(() => ({}))
  const message = body.message ?? ''

  if (res.status === 200) {
    return { name, ok: true, status: 'registered', detail: message }
  }
  if (res.status === 401) {
    return {
      name,
      ok: false,
      status: 'BAD SIGNING KEY',
      detail: `${message} — every background job on this engine is dead. Copy the current key from app.inngest.com (Keys -> Signing key) into INNGEST_SIGNING_KEY and redeploy.`,
    }
  }
  // 400 usually means the key is fine but a function config is rejected, e.g.
  // a concurrency limit above the plan. Different problem, still broken.
  return { name, ok: false, status: `HTTP ${res.status}`, detail: message }
}

const results = await Promise.all(ENGINES.map(check))

let broken = 0
console.log('\nInngest fleet health\n' + '-'.repeat(60))
for (const r of results) {
  const icon = r.ok ? 'OK  ' : 'FAIL'
  console.log(`${icon} ${r.name.padEnd(18)} ${r.status}`)
  if (!r.ok) {
    broken++
    console.log(`     ${r.detail}`)
  }
}
console.log('-'.repeat(60))
console.log(`${results.length - broken}/${results.length} healthy\n`)

process.exit(broken > 0 ? 1 : 0)
