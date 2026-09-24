cd C:\Users\bradp\dev\fanout

Open src/distributors/reddit.ts and make it upload media. Then threads.ts, then
mastodon.ts, then youtube.ts. Work in that order, one file per pass, commit
between each.

## THE TASK

Four distributors are silently dropping what the user gave them. Each `post()`
receives `payload.mediaUrls` and never reads it — the post succeeds, the user
sees "posted", and the image is gone. Same defect already fixed on Twitter in
cf9621f; read that commit first, it is the template.

**Pass 1 — reddit.ts.** Reddit needs a separate submit path for images
(`kind: 'image'` with a lease-uploaded asset, not `kind: 'self'`). If a media
post cannot be made to work, FAIL LOUDLY rather than posting text and
discarding the image.

**Pass 2 — threads.ts.** Threads is a two-step publish: create a media
container (`POST /{user}/threads` with `media_type=IMAGE` + `image_url`), then
publish it (`POST /{user}/threads_publish`). Text-only posts keep the current
single-step path.

**Pass 3 — mastodon.ts.** Simplest of the four: `POST /api/v2/media` to get
attachment ids, then pass `media_ids[]` on the status. Do this one if short on
time.

**Pass 4 — youtube.ts.** DIFFERENT DEFECT, bigger. It posts text to
`/youtube/v3/posts`, which is not how video gets to YouTube. It needs
`videos.insert` with a resumable upload. This is a real build, not a media
flag — if it does not fit the session, STOP after pass 3 and say so.

DONE WHEN, each pass: a test asserts the provider call carries the media, and
deleting the media handling makes that test fail. `npx tsc --noEmit` clean,
committed, pushed, Vercel READY.

## HOW TO VERIFY — non-negotiable, this repo has been burned by both

1. **Mutation-check every test you write.** Break the thing under test, run the
   test, confirm it FAILS, restore. A test that passes on broken code is worse
   than no test. Three times last session my own tests did not discriminate the
   mutation they existed to catch — green means nothing until you have seen it
   go red.
2. **Never parse Vercel CLI output.** Use `mcp__claude_ai_Vercel__get_deployment`
   and read `state` + `meta.githubCommitSha`. Two silent-failure incidents last
   session came from grepping `vercel inspect`; also note `cmd | tail` reports
   TAIL's exit code, not the command's.
3. After every push: `git ls-remote origin main | grep $(git rev-parse HEAD)`.

## DO NOT DO THESE

- Do not re-audit the six security fixes or the eight isolation probes. Closed,
  live, mutation-verified. Listed at the bottom.
- Do not write an A/B/C probe for v1/profiles. Admin provisioning route, orgId
  comes from the body BY DESIGN, no per-profile boundary, 12 existing tests
  already cover the real gate. Manufacturing one is coverage theater.
- Do not chase `npm run build` failing locally. There is no .env.local in this
  repo; it dies on a missing Clerk key at prerender. Vercel builds fine.
- Do not re-investigate CRON_SECRET. Set in all three environments, verified.

## IF YOU FINISH THE MEDIA WORK

Next, in order:
  1. IMAGE GENERATION + AI CONTENT ENHANCEMENT — Brad asked for both, neither
     started. Scope it before building; it is not a small feature.
  2. DASHBOARD ISOLATION — tests/helpers/predicate-db.ts now covers v1, but
     /api/dashboard uses Clerk org auth instead of API keys, so it is a
     different boundary the harness does not reach. Two dashboard defects were
     found by inspection last session (biolink PATCH mass assignment,
     generate-content proxy), which is weak evidence more exist.

## NEEDS BRAD — cannot be closed by code

- **ORG-CREATION P0 UNVERIFIED.** Nobody has watched a genuinely NEW user sign
  up. Launch blocker, needs a human doing a real signup.
- fanout.digital is NOT in Resend and RESEND_API_KEY is "placeholder", so
  noreply@/onboarding@fanout.digital silently fail. No transactional email.
- john@fanout.digital still forwards to a personal Gmail. Repoint to John's
  NuStack mailbox — that external hop is what made Gmail reject forwarded mail.
- Frontend redesign (John): only evidence is an 8.5s phone video of a monitor
  showing a new logo. NOT ACTIONABLE. Need the HTML, a URL, a Figma file, or
  full-page screenshots at desktop + mobile widths.

## STATE — read only if the above is not enough

Tests: 352 passing, 26 files. `npm test`.
Stack: Next.js 16 App Router, Supabase, Clerk, Inngest, Vercel.
Proven live against real providers: Facebook and Bluesky both published, and
TRUE FAN-OUT (one post to both simultaneously) succeeded.

Security track, all fixed + live + mutation-verified:
  11a57ed  fan-out (post,profile,platform) tuple bound before token selection
  de8b0bd  DM replies refused on all 5 public transports (allowlist, not denylist)
  095acad  cron auth fails closed — 5 cron routes + generate-social-content
  3be5875  Meta Page access tokens no longer returned to the browser
  a523777  biolink PATCH allowlist (was mass assignment via ...rest)
  de7ab32  generate-content proxy vets body before lending INTERNAL_API_KEY

Isolation track, 8 of 9 v1 routes proven by A/B/C probe:
  2592e63  tests/helpers/predicate-db.ts + v1/history
  ab62b30  v1/analytics/account
  49c911f  v1/analytics/[postId]
  af88ca7  v1/platforms + status + disconnect (oauth_tokens, read AND delete)
  c55b360  v1/post + v1/schedule (write boundary)

Extending the harness? Two traps, both hit for real:
  - Seed rows need org_id, or an org-scoped filter matches NOTHING and the
    org-scoped leak reads as a pass.
  - Do not confound the discriminator with tenancy. Every principal must share
    platform/date values, or a handler filtering by platform excludes siblings
    coincidentally and looks correctly scoped.

Notion: CC COMPLETE 3e4663704e4081c1806dc470c7fd0c4d
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
