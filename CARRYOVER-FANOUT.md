cd C:\Users\bradp\dev\fanout

Open src/distributors/youtube.ts. Read the SCOPE note below BEFORE writing code —
the previous session stopped here deliberately, not because it ran out of time.

## THE TASK — YOUTUBE VIDEO PUBLISHING

youtube.ts posts text to `/youtube/v3/posts` (community posts), which is not how
video gets to YouTube. It needs `videos.insert` with a resumable upload.

Three things block this, and none are fixed by editing the distributor:

1. **No video ever reaches the distributor.** `mediaUrls` is validated as
   `z.array(z.string().url())` in v1/post, v1/schedule, dashboard/post and
   mobile/posts — no MIME type, no image/video distinction anywhere in the
   pipeline. `videos.insert` must know a URL is a video. Decide how that is
   carried (a typed media object? sniff Content-Type at post time?) before
   touching youtube.ts.

2. **Resumable upload does not fit a serverless request.** Initiate session,
   stream multi-MB bytes, handle 308-resume — inside a Vercel function with a
   request timeout. This is a decision about WHERE the upload runs (Inngest job,
   or direct-from-client with the server only minting the session URL), not a
   distributor patch.

3. **It is a product question.** Community posts and video publishing are two
   different features. Which one Fanout offers is Brad's call — ASK before
   building. Replacing the community-post path outright removes a working
   feature for channels that have it.

Scope it first. `/scope-check` then `/research-build mode=engine` per CLAUDE.md
— this is a feature, not a fix.

## DONE, LIVE, MUTATION-VERIFIED — do not redo

The media track from the last carryover is finished for 3 of 4 distributors.
Each asserts the PROVIDER CALL carries the media (not that post() returned
success — it did that throughout the entire defect), and each assertion was
proven to go red under a mutation before being committed.

  6c0472a  reddit   — lease → S3 bytes → kind:'image'. 4 mutants.
  d46f44a  threads  — media_type IMAGE + image_url on the container. 3 mutants.
  a35c79f  mastodon — v2/media → media_ids[] on the status. 4 mutants.

Failure policy DIFFERS BY PLATFORM and that is deliberate — do not "make it
consistent":
  - Reddit FAILS THE POST if upload fails. kind:'image' and kind:'self' are
    different post types; silently downgrading publishes something the user did
    not ask for.
  - Mastodon and Twitter POST THE TEXT ANYWAY. A status is the same kind of
    object with or without an attachment, so losing the image degrades the post
    rather than changing what it is.
Tests pin both policies. A mutant that swaps one for the other fails.

## AFTER YOUTUBE (or instead of it, if Brad defers video)

  1. IMAGE GENERATION + AI CONTENT ENHANCEMENT — Brad asked for both, neither
     started. Scope before building; not a small feature.
  2. DASHBOARD ISOLATION — tests/helpers/predicate-db.ts covers v1, but
     /api/dashboard uses Clerk org auth instead of API keys, so it is a
     different boundary the harness does not reach. Two dashboard defects were
     found by inspection last session (biolink PATCH mass assignment,
     generate-content proxy), which is weak evidence more exist.

## HOW TO VERIFY — non-negotiable, this repo has been burned by both

1. **Mutation-check every test you write.** Break the thing under test, run the
   test, confirm it FAILS, restore, and diff to confirm the restore is
   byte-identical. A test that passes on broken code is worse than no test.
2. **Never parse Vercel CLI output.** Use `mcp__claude_ai_Vercel__get_deployment`
   and read `state` + `meta.githubCommitSha`. Also note `cmd | tail` reports
   TAIL's exit code, not the command's.
3. After every push: `git ls-remote origin main | grep $(git rev-parse HEAD)`.
4. This repo is CRLF. A heredoc-written fragment is LF and will not match an
   anchor — normalize both sides before splicing, and write back as CRLF.

## DO NOT DO THESE

- Do not re-audit the six security fixes or the eight isolation probes. Closed,
  live, mutation-verified. Listed at the bottom.
- Do not re-do the reddit/threads/mastodon media work. Listed above with SHAs.
- Do not write an A/B/C probe for v1/profiles. Admin provisioning route, orgId
  comes from the body BY DESIGN, no per-profile boundary, 12 existing tests
  already cover the real gate. Manufacturing one is coverage theater.
- Do not chase `npm run build` failing locally. There is no .env.local in this
  repo; it dies on a missing Clerk key at prerender. Vercel builds fine.
- Do not re-investigate CRON_SECRET. Set in all three environments, verified.

## NEEDS BRAD — cannot be closed by code

- **ORG-CREATION P0 UNVERIFIED.** Nobody has watched a genuinely NEW user sign
  up. Launch blocker, needs a human doing a real signup.
- **YOUTUBE PRODUCT CALL** (new) — community posts, video publishing, or both?
  Blocks the task at the top of this file.
- fanout.digital is NOT in Resend and RESEND_API_KEY is "placeholder", so
  noreply@/onboarding@fanout.digital silently fail. No transactional email.
- john@fanout.digital still forwards to a personal Gmail. Repoint to John's
  NuStack mailbox — that external hop is what made Gmail reject forwarded mail.
- Frontend redesign (John): only evidence is an 8.5s phone video of a monitor
  showing a new logo. NOT ACTIONABLE. Need the HTML, a URL, a Figma file, or
  full-page screenshots at desktop + mobile widths.

## STATE — read only if the above is not enough

Tests: 365 passing, 29 files. `npm test`.
Stack: Next.js 16 App Router, Supabase, Clerk, Inngest, Vercel.
Proven live against real providers: Facebook and Bluesky both published, and
TRUE FAN-OUT (one post to both simultaneously) succeeded.

Media track (the theme opened in cf9621f) — status by distributor:
  twitter   cf9621f  DONE (no test; covered only by the pattern it set)
  reddit    6c0472a  DONE + mutation-verified
  threads   d46f44a  DONE + mutation-verified
  mastodon  a35c79f  DONE + mutation-verified
  youtube   OPEN     — different, larger defect. See top of file.
Already handled media before this track: bluesky, facebook, instagram,
pinterest, tiktok, google-business-profile.

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
