cd C:\Users\bradp\dev\fanout

## STATE 2026-09-23 (late) — P0 SECURITY TRACK CLOSED. Six defects fixed, all live.

Read "DO THIS FIRST", act, then the rest only if needed.

## DO THIS FIRST — the security track is DONE. Next is a decision, not a build.

All six known security defects are fixed, mutation-verified, pushed and live
on fanout.digital. Tests went 205 -> 291. Nothing on the security track is
open. Do NOT re-audit these; they are closed:

  11a57ed  P0-1 fan-out token/post tuple binding
  de8b0bd  P0-2 DM replies refused on all five public transports
  095acad  P0-3 cron auth fails closed (5 cron routes + generate-social-content)
  3be5875  Meta Page access tokens no longer returned to the browser
  a523777  biolink PATCH allowlist (was mass assignment)
  de7ab32  generate-content proxy vets the body before lending INTERNAL_API_KEY

**THE NEXT SESSION MUST PICK ONE.** Brad has not chosen between:

  (A) POLISH — the deferred product work. Reddit/threads/mastodon ignore
      mediaUrls (same class as the twitter bug fixed in cf9621f). YouTube
      posts text to /youtube/v3/posts instead of videos.insert. Image
      generation + AI content enhancement, both asked for, neither started.

  (B) PROVE ISOLATION — see the test-suite limitation below. The 291 passing
      tests still CANNOT prove A/B/C profile isolation, because the two v1
      history/analytics tests return canned rows. This is the last thing
      standing between "secure by inspection" and "secure by evidence".

  (C) ORG-CREATION P0 — still UNVERIFIED. Nobody has watched a genuinely NEW
      user sign up. This is a launch blocker and needs a real signup, not code.

CC's recommendation: **(B) then (A)**. Isolation is the claim a client will
actually rely on, and it is currently unproven rather than merely untested.
Polish makes posts prettier; none of it is blocking.

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

## TEST-SUITE LIMITATION — unchanged, and now the main gap
tests/api/v1-history.test.ts and v1-account-analytics.test.ts record filters
but return canned rows. The 291 passing tests CANNOT prove A/B/C profile
isolation. A real resolver with predicate-enforcing fixtures is required
before claiming isolation works. This is option (B) above.

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
291 passing, 21 files. `npm test`. Every security fix this session is
mutation-verified: the guard was broken, the tests were confirmed to fail, the
guard was restored. Counts are in each commit message.

## KEY FILES
  src/lib/cron-auth.ts                          <- shared fail-closed bearer check
  src/lib/fan-out.ts                            <- assertTupleMatches()
  docs/audits/FANOUT-AYRSHARE-PARITY-PLAN.md    <- the plan + NATIVE decision
  docs/audits/FANOUT-CORRECTION-EXPOSURE-*.md   <- the audit these six came from
  scripts/check-inngest-health.mjs              <- npm run health:inngest

## NOTION
CC COMPLETE: 3e4663704e4081c1806dc470c7fd0c4d
Parity plan: 3e4663704e4081b5bf97f6e3ece3a240
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
