cd C:\Users\bradp\dev\fanout

## STATE 2026-09-23 (late) — SECURITY CLOSED + ISOLATION PROVEN ACROSS v1.

Read "DO THIS FIRST", act, then the rest only if needed.

## DO THIS FIRST — the isolation sweep is done. Pick a track below.

Six security defects fixed and live. Tenant isolation is now PROVEN (not
merely tested) on every v1 route that has a tenant boundary. Tests 205 -> 352.

  11a57ed  P0-1 fan-out token/post tuple binding
  de8b0bd  P0-2 DM replies refused on all five public transports
  095acad  P0-3 cron auth fails closed (5 cron routes + generate-social-content)
  3be5875  Meta Page access tokens no longer returned to the browser
  a523777  biolink PATCH allowlist (was mass assignment)
  de7ab32  generate-content proxy vets the body before lending INTERNAL_API_KEY
  2592e63  tests/helpers/predicate-db.ts + A/B/C probe for v1/history
  ab62b30  A/B/C probe for v1/analytics/account
  49c911f  A/B/C probe for v1/analytics/[postId]
  af88ca7  A/B/C probe for v1/platforms + status + disconnect (oauth_tokens)
  c55b360  A/B/C probe for v1/post + v1/schedule (the write boundary)

**THE ISOLATION SWEEP IS COMPLETE.** All nine v1 routes accounted for:

  PROVEN by A/B/C probe (8): history, analytics/account, analytics/[postId],
    platforms, platforms/status, platforms/[platform] DELETE, post, schedule
  NOT PROBED, deliberately (1): profiles — an admin provisioning route with
    NO per-profile tenant boundary. orgId comes from the body BY DESIGN
    (documented in the route). Its 12 existing tests already cover the gate
    that matters: fail-closed on unset FANOUT_ADMIN_KEY, constant-time
    compare, prefix-attack rejection, hash non-disclosure. An A/B/C probe
    would add nothing. Do NOT manufacture one.

Next session, pick one:

  (A)  POLISH — reddit/threads/mastodon ignore mediaUrls (same class as the
       twitter bug fixed in cf9621f). YouTube posts text to /youtube/v3/posts
       instead of videos.insert. Image generation + AI enhancement, both asked
       for, neither started. RECOMMENDED — it is the only track left that
       adds product.

  (C)  ORG-CREATION P0 — still UNVERIFIED. Needs a real signup watched by a
       human, not code. Launch blocker. Brad-only.

  (D)  DASHBOARD ISOLATION — the harness now covers v1. The /api/dashboard
       routes were NOT swept; they use Clerk org auth rather than API keys, so
       they are a different boundary and a separate pass. Two dashboard
       defects were already found by inspection this session (biolink PATCH,
       generate-content proxy), which is weak evidence that more exist.

CC's recommendation: **(A)**, then (D). Security and isolation are done; the
product gap is now the binding constraint.

## HOW THE ISOLATION HARNESS WORKS — read before extending it

tests/helpers/predicate-db.ts. The OLD fixtures (tests/api/v1-history.test.ts,
v1-account-analytics.test.ts) record the filters a handler builds and then
return canned rows regardless. They prove a handler CALLED .eq('profile_id',…)
but not that the call had any EFFECT. Measured: seeding a row owned by
profile-B into the old history fixture left all 18 tests passing.

createPredicateDb() APPLIES the filters. Seed three principals at once —
A (caller), B (sibling profile, SAME org), C (foreign org) — and a leak shows
up as another tenant's data in the response body.

Two fixture traps, both hit and fixed while building this. Watch for them when
you add a route:
  1. **Seed rows need org_id.** Without it an org-scoped filter matches
     NOTHING, so the org-scoped leak reads as a pass.
  2. **Do not confound the discriminator with tenancy.** Each tenant must
     share platform/date values with A. When each tenant had its own platform,
     a handler filtering by platform excluded siblings COINCIDENTALLY and
     looked correctly scoped — the old suite caught that mutation and the new
     probe did not, until the seed was fixed.

Mutation numbers are in each commit. New probe vs old suite, v1/history:
posts filter deleted 6v2, org-scoped 5v2, wrong value 4v2, sync-state only 3v1.

## WHAT WAS FIXED THIS SESSION — detail

Each fix closed the CLASS, not the reported path. That distinction mattered
three times:

1. **P0-3 was wider than reported.** The carryover named process-queue. The
   same fail-open line was copy-pasted across FIVE cron routes plus
   generate-social-content. Fixed once in src/lib/cron-auth.ts, with a
   tree-scan test asserting no source file outside it contains the idiom.

2. **P0-2 was inverted, not patched.** Adding the type check to the four
   unguarded branches would leave the same hole for the fifth transport. The
   gate is now an ALLOWLIST above all transports: unknown types are refused
   by default.

3. **P0-1 lives in fanOut(), not its callers**, so scheduled jobs are
   rechecked after sleepUntil and retries on every replay.

**CRON_SECRET correction:** an earlier note said it was Production-only. It is
set in ALL THREE environments (Production, Preview, Development — 177d ago).
The fail-open was latent everywhere, never exposed. Do not re-investigate.

## TEST-SUITE LIMITATION — RESOLVED for v1
The old canned-row fixtures still exist and still pass; they are kept because
they cover query-shape details (ordering, keyset pagination, limit probing)
that the isolation probes do not. They are no longer the only evidence for
any v1 route. The /api/dashboard routes remain unswept — that is option (D).

## WHAT IS PROVEN (against real providers)
- Facebook: OAuth -> Page -> Compose -> Inngest fan-out -> Graph API -> real
  published post. 3 posts, 0 failures.
- Bluesky: same pipeline, different auth model (app password, not OAuth).
- TRUE FAN-OUT: one post to Facebook AND Bluesky simultaneously, both
  succeeded. That is the Ayrshare value proposition, working.

## STILL OPEN (product, none security)
- YOUTUBE posts text to /youtube/v3/posts instead of videos.insert.
  REDDIT, THREADS, MASTODON still ignore mediaUrls.
- IMAGE GENERATION + AI CONTENT ENHANCEMENT — Brad asked for both, not started.
- ORG-CREATION P0 STILL UNVERIFIED (option C above).
- fanout.digital is NOT in Resend and RESEND_API_KEY is "placeholder" —
  noreply@/onboarding@fanout.digital would silently fail. No transactional
  email yet.
- Vercel team split deferred (20+ projects incl. client work in one team).
- 3 Clerk orgs across 5 profiles — org sprawl will confuse a real client.
- `npm run build` fails LOCALLY on missing Clerk publishableKey. There is no
  .env.local in this repo. Pre-existing and environmental — Vercel builds
  fine. Do not chase it.

## FRONTEND REDESIGN (John, not started in-repo)
John is redesigning the Fanout frontend. Evidence so far is ONE 8.5s phone
video of a monitor (OneDrive/CLAUDE BUILT APPS.../Fanout.Digital/IMG_5774.mov)
showing only a NEW LOGO: green fan/arrow mark on a dark rounded tile, lowercase
wordmark. The mark would make a far better square profile picture than the
current 120x32 wordmark.
NOT ACTIONABLE AS-IS. To build it, need one of: the HTML he is working in
(local on his machine, C:/Users/fr...), a deployed URL, a Figma file, or
full-page screenshots at desktop + mobile widths.
Frontend lives in src/app/ (Next.js + shadcn). A redesign there is a real
build, not a paste.

## OPEN — NOT CODE
- john@fanout.digital still forwards to a personal Gmail. Repoint it to
  John's new NuStack mailbox — that removes the external hop that was causing
  Gmail to reject forwarded mail (Microsoft was accepting it all along;
  Resend reported the downstream forward failure as a bounce).

## TESTS
352 passing, 26 files. `npm test`. Every security fix this session is
mutation-verified: the guard was broken, the tests were confirmed to fail, the
guard was restored. Counts are in each commit message.

## KEY FILES
  tests/helpers/predicate-db.ts                 <- the isolation harness
  src/lib/cron-auth.ts                          <- shared fail-closed bearer check
  src/lib/fan-out.ts                            <- assertTupleMatches()
  docs/audits/FANOUT-AYRSHARE-PARITY-PLAN.md    <- the plan + NATIVE decision
  docs/audits/FANOUT-CORRECTION-EXPOSURE-*.md   <- the audit these six came from
  scripts/check-inngest-health.mjs              <- npm run health:inngest

## NOTION
CC COMPLETE: 3e4663704e4081c1806dc470c7fd0c4d
Parity plan: 3e4663704e4081b5bf97f6e3ece3a240
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
