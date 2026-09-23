cd C:\Users\bradp\dev\fanout

## STATE 2026-09-23 (end of day) — IT POSTS. Facebook AND Bluesky, proven live.

Read "DO THIS FIRST", act, then the rest only if needed.

## DO THIS FIRST

1. RUN THE PLATFORM REGISTRATION PROMPT with CFC. It is in the session
   transcript: six platforms, easiest to hardest — Reddit (instant), X/Twitter
   (instant, check the paid tier), LinkedIn (1-2d), YouTube (~1wk), Pinterest
   (1-2wk), TikTok (1-2wk).
   These register FANOUT's developer apps, not a client's. One app per platform,
   ever; every client connects through it. Name them all "Fanout".
   Submit the slow ones early — the waiting is the cost, not the work.

2. EMAIL JOHN. Draft is in the transcript. His Business-portfolio bug is fixed
   and deployed; he can retry. His Open Play Project Page is the better pilot
   target than Lockelum — it sits in a Business portfolio, which is how real
   agency clients are set up.

## WHAT IS PROVEN (first time, against real providers)
- Facebook: OAuth -> Page selected -> Compose -> Inngest fan-out -> Graph API ->
  real published post. 3 posts, 0 failures.
- Bluesky: same pipeline, different auth model (app password, not OAuth).
- TRUE FAN-OUT: one post went to Facebook AND Bluesky simultaneously, both
  succeeded. That is the whole Ayrshare value proposition, working.

## THE BIG FIND TODAY
Nothing had EVER published, and it was not code. INNGEST_SIGNING_KEY in Vercel
was stale on ALL FIVE ENGINES. The EVENT key worked, so the UI said "Post
queued!" while Inngest could never invoke a function. Posts sat Pending forever
with no error anywhere.
  npm run health:inngest      <- catches it. exit 1 if anything is broken.
GET /api/inngest reports has_signing_key:true even while the key is REJECTED.
Only PUT exercises it. Presence is not validity.
Fleet was 5/5 healthy at end of day.

## SHIPPED TODAY (all pushed, all verified)
  N1-N6 native history COMPLETE: external_posts schema, listPosts on
    facebook/instagram/twitter/bluesky, resumable backfill, GET /api/v1/history,
    read scopes, account_analytics + collector + GET /api/v1/analytics/account
  cf9621f  twitter media upload (was SILENTLY discarding every image);
           linkedin now posts as the Company Page, not the account manager's
           personal profile
  d38ee57  docs/Client-Social-Media-Setup-Template.xlsx — client onboarding
           workbook, script-generated (scripts/build-client-credentials-workbook.mjs)
  Plan upgraded trial -> starter (3 profiles). LockeLum profile created.
  Meta app renamed so posts no longer say "NuStack Marketing API".

## STILL OPEN
- YOUTUBE posts text to /youtube/v3/posts instead of videos.insert. REDDIT,
  THREADS, MASTODON still ignore mediaUrls (same class as the twitter bug just
  fixed). This is the "make posts look decent everywhere" work.
- IMAGE GENERATION + AI CONTENT ENHANCEMENT — Brad asked for both. Not started.
  Deliberately held until posting was proven; it now is, so these are next.
- info@fanout.digital mailbox CREATED (id f8ebcba2-fdf5-4483-a7e1-7d677304187a),
  sign-in disabled. Forward to brad@nustack.digital was still applying when the
  session ended — Exchange takes 15-60 min to provision. VERIFY IT, do not
  assume. If missing, add the inbox rule via Graph (see
  memory/m365-graph-automation.md).
- fanout.digital is NOT in Resend and RESEND_API_KEY is "placeholder", so
  noreply@ / onboarding@fanout.digital in the code would silently fail. Fanout
  cannot send transactional email yet.
- ORG-CREATION P0 STILL UNVERIFIED. Nobody has watched a genuinely NEW user sign
  up. John's next session is the moment.
- Vercel team split deferred (20+ projects incl. client work in one team; moving
  a live project touches 69 env vars and the domain). Needs explicit go-ahead.
- 3 Clerk orgs across 5 profiles — org sprawl will confuse a real client.
- agency-engine + 2 others: check inngest SDK >= 3.54.0.

## TESTS
205 passing, 15 files. npm test. Several mutation-verified — breaking the code
under test fails them. Do not trust a suite not shown to fail.

## KEY FILES
  docs/audits/FANOUT-AYRSHARE-PARITY-PLAN.md    <- the plan + NATIVE decision
  docs/Client-Social-Media-Setup-Template.xlsx  <- client onboarding
  scripts/check-inngest-health.mjs              <- npm run health:inngest

## NOTION
CC COMPLETE: 3e4663704e4081c1806dc470c7fd0c4d
Parity plan: 3e4663704e4081b5bf97f6e3ece3a240
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
