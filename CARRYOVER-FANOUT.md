cd C:\Users\bradp\dev\fanout

## STATE 2026-09-23 — IT POSTS. Fanout published its first real post today.

Everything below the "DO THIS FIRST" block is context. Read that block, act, then
read the rest only if you need it.

## DO THIS FIRST (two things, both need Brad)

1. POST TO BLUESKY from Compose.
   fanout.digital/dashboard/compose -> profile "CFC Test Brand" -> tick Bluesky
   ONLY -> Post. Facebook already proved the pipeline, but via an event CC
   re-emitted by hand. Bluesky proves the NORMAL user path now that Inngest
   works. Bluesky is connected and verified; it needs no Meta anything.
   Then check: the post should appear at bsky.app/profile/lockelum.bsky.social

2. EMAIL JOHN. Draft is in the session transcript. He found the Business-portfolio
   bug; the fix is deployed and he can retry. His Page (Open Play Project) is the
   better pilot target than Lockelum — it is in a Business portfolio, which is how
   real agency clients are set up.

## WHAT HAPPENED TODAY — the headline

Nothing had EVER published, and the cause was not code.

INNGEST_SIGNING_KEY in Vercel was stale (signkey-prod-b5f656f...) while the
Inngest account's real key was signkey-prod-bc781dd... The EVENT key was fine, so
inngest.send() succeeded and the UI said "Post queued!" — but Inngest could never
invoke a function. Posts sat at Pending forever with no error in the UI, no
post_results row, and nothing in the logs. 179 passing tests said otherwise
because they mock the transport.

ALL FIVE ENGINES had the same stale key. Fixed on all five; fleet now 5/5.

  npm run health:inngest     <- run this any time. exit 1 if anything is broken.

That script exists because GET /api/inngest reports has_signing_key: true even
while the key is REJECTED. Only PUT exercises it. Presence is not validity.

## PROVEN WORKING (first time, end to end, against real providers)
- Facebook OAuth -> token encrypted -> Page selected -> Compose -> Inngest
  fan-out -> Graph API -> REAL published post:
  https://www.facebook.com/1232498056612909/posts/122126177427373572
  post_results: status=success, real platform_post_id, 0 errors.
- Bluesky listPosts verified against the LIVE API (real URI, URL, text,
  timestamp, metrics, working cursor). Account lockelum.bsky.social, DID
  verified, credentials encrypted.

## NATIVE HISTORY CHAIN — N1-N5 COMPLETE (Ayrshare parity feature)
  N5 aaf34f5  read scopes, added BEFORE clients connect (scope changes force
              re-consent). LinkedIn native history is BLOCKED: r_member_social
              is a CLOSED permission, do not request it — it fails the WHOLE
              authorization, not just history.
  N1 7340e77  external_posts + external_post_sync_state (live in DB)
  N2 5859641  listPosts on facebook/instagram/twitter
  +  7523812  listPosts on bluesky (live-API verified)
  N3 b5fc352  resumable backfill, one page per run, re-emits itself
  N4 bb2d57b  GET /api/v1/history, profile-scoped
  N6 account-level analytics = NOT STARTED. Genuinely new construction per CX,
     not exposure. Nothing is waiting on it.

## STILL OPEN
- ORG-CREATION P0 STILL UNVERIFIED. Nobody has watched a genuinely NEW user sign
  up. Brad's account already had an org. John's next session is the moment.
- Vercel team split. 20+ projects incl. client work in one team; John would see
  all of it. DEFERRED because moving a live project touches 69 env vars and the
  fanout.digital domain. Needs Brad's explicit go-ahead.
- Org sprawl: 3 Clerk orgs across 4 profiles. Each signup made its own. Will
  confuse a real client.
- Facebook Page is named "Lockelum" — brand rule is LockeLum. Cosmetic.
- 3 engines on an Inngest SDK with a flagged security issue (<3.54.0).
  wellness-engine is fixed; check content-engine and marketing-engine.

## TODAY'S OTHER FIXES (all pushed)
  58ef783  P1: inbound-sms webhook accepted UNSIGNED writes to production
  6d9d85a  P1: /api/social-status + social-queue leaked NuStack's queue to any
           tenant (checked that SOME org existed, never WHICH)
  b4f9a5f  4 CX findings incl. a live cross-tenant biolink read
  e62e94d  business_management scope + auth_type=rerequest + escape from the
           "Finish setup" dead end
  434b873  Compose no longer pre-selects every connected platform. It had the
           REAL lockelum Bluesky account pre-ticked on a test post.
  0ab5fa1  /api/dashboard/platforms/[platform]/diagnose — asks Meta what was
           actually granted. Use it whenever a Page picker is empty.
  63139d3  @types/node ^24 — --legacy-peer-deps had hidden a conflict that
           broke EVERY production deploy.
  c8ff802  the fleet health check
  wellness-engine 7673a81, agency-engine 15831d4 (different repos)

## TESTS
179 passing, 13 files. npm test. Several are mutation-verified — breaking the
code under test fails them. Do not trust a suite that has not been shown to fail.

## KEY DOCS IN REPO
  docs/audits/FANOUT-AYRSHARE-PARITY-PLAN.md   <- the plan, with the NATIVE
                                                  scope decision and its 4
                                                  measured blockers
  docs/audits/FANOUT-GAP-ANALYSIS-2026-09-23.md
  scripts/check-inngest-health.mjs

## NOTION
CC COMPLETE:  3e4663704e4081c1806dc470c7fd0c4d
Parity plan:  3e4663704e4081b5bf97f6e3ece3a240
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
