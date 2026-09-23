cd C:\Users\bradp\dev\fanout

## STATE 2026-09-23 (evening) — IT POSTS. Now it has to be SAFE to expose.

Read "DO THIS FIRST", act, then the rest only if needed.

## DO THIS FIRST — no decisions needed, just build

**THE TRACK IS P0 SECURITY. It is already decided. Do not re-litigate it.**
Polish work (media on reddit/threads/mastodon, youtube videos.insert, image
generation, AI enhancement) is DEFERRED until the three P1 defects close.
Reason: polish makes posts prettier; P0 stops one client's key from reaching
another client's tokens.

Build in this order. Each is a separate micro-prompt, max 3 files, verify with
`npx tsc --noEmit` and commit before starting the next.

**P0-1. Fan-out token/post pairing** (src/lib/fan-out.ts)
  Defect: `:52` reads post by id, `:65` picks tokens by separately-supplied
  profileId. Proven: probe dispatched post-B content on token-A.
  Fix: reject any job whose (post, profile, platform) tuple does not match
  before tokens are selected, before any write, notification, webhook or
  provider call. Recheck on retry and on schedule.
  Callers to update: fan-out-post.ts:51, scheduled-post.ts:22, retry-post.ts:31.
  DONE WHEN: a test that constructs a mismatched tuple FAILS the job, and
  breaking the guard makes that test fail.

**P0-2. DM replies on public transports** (src/app/api/dashboard/inbox/route.ts)
  Defect: `:155` rejects type `dm` for Meta; `:168/:184/:203` do not check type
  at all for Twitter/YouTube/LinkedIn. A private DM can be published publicly.
  Fix: reject `dm` and unknown types for EVERY public transport before token
  decryption and before any provider call. Do not mark replied from caller
  status alone.
  DONE WHEN: type `dm` produces zero provider calls on all five platforms.

**P0-3. Fail-open cron auth** (src/app/api/cron/process-queue/route.ts:8)
  Defect: accepts literal `Bearer undefined` when CRON_SECRET is unset.
  FIRST: check whether CRON_SECRET is actually set in Vercel — that decides
  whether this is live or latent. Then fail closed on missing/empty secret and
  audit the sibling guards in generate-social-content/route.ts:55-57.
  DONE WHEN: a request with no secret configured returns 401, not 200.

Then reassess. Do NOT start polish work without saying so explicitly.

## THE THREE P1 DEFECTS (found 2026-09-23, PLAN ONLY, nothing fixed)

Both CX and CC reached these independently, each with actual-source probes —
not by reading commit messages. Full detail:
  docs/audits/FANOUT-CORRECTION-EXPOSURE-PLAN-20260923.md   (CX plan)
  docs/audits/FANOUT-CORRECTION-EXPOSURE-CC-20260923.md     (CC review)
  docs/audits/fanout-plan-probe-20260923.cjs                (the probe)

1. **Worker token/post pairing.** `src/lib/fan-out.ts:52` reads the post by id;
   `:65` independently selects tokens by the supplied profileId. An in-memory
   probe dispatched post-B content using token-A and recorded four mocked
   writes. Callers pass event tuples directly (fan-out-post.ts:51,
   scheduled-post.ts:22, retry-post.ts:31).
   Local worker invariant failure PROVEN. Public exploitability UNPROVEN.

2. **Fail-open cron auth.** `src/app/api/cron/process-queue/route.ts:8` accepts
   a literal `Bearer undefined` when CRON_SECRET is unset. Probe with the
   secret missing returned 200, processed 1. Deployed env UNPROVEN — check
   whether CRON_SECRET is actually set in Vercel before rating severity.

3. **DM replies reaching public transports.** `dashboard/inbox/route.ts:155`
   rejects type `dm` for Meta, but `:168/:184/:203` select Twitter, YouTube and
   LinkedIn public reply transports with no type check. Probe: Meta rejected
   with zero calls; the other three each made one mocked provider call.
   A private DM can be published publicly.

Also reopened and needing the same treatment: biolink PATCH forwards arbitrary
rest into update (:99-113); dashboard generate-content proxies arbitrary body
with INTERNAL_API_KEY (:24-36); select-page returns provider objects INCLUDING
access_token (:63-70).

**Test-suite limitation, important:** tests/api/v1-history.test.ts and
v1-account-analytics.test.ts record filters but return canned rows. The 205
passing tests CANNOT prove A/B/C profile isolation. A real resolver with
predicate-enforcing fixtures is required before claiming isolation works.

## WHAT IS PROVEN (first time, against real providers)
- Facebook: OAuth -> Page -> Compose -> Inngest fan-out -> Graph API -> real
  published post. 3 posts, 0 failures.
- Bluesky: same pipeline, different auth model (app password, not OAuth).
- TRUE FAN-OUT: one post to Facebook AND Bluesky simultaneously, both
  succeeded. That is the Ayrshare value proposition, working.

## SHIPPED (all pushed and verified except 3219299)
  N1-N6 native history COMPLETE: external_posts schema, listPosts on
    facebook/instagram/twitter/bluesky, resumable backfill, GET /api/v1/history,
    read scopes, account_analytics + collector + GET /api/v1/analytics/account
  cf9621f  twitter media upload (was SILENTLY discarding every image);
           linkedin posts as Company Page, not the manager's personal profile
  3219299  the two audit docs + probe        <- LOCAL ONLY, PUSH IT

## STILL OPEN (product)
- YOUTUBE posts text to /youtube/v3/posts instead of videos.insert.
  REDDIT, THREADS, MASTODON still ignore mediaUrls — same class as the twitter
  bug already fixed.
- IMAGE GENERATION + AI CONTENT ENHANCEMENT — Brad asked for both. Not started.
  Held until posting was proven; it now is.
- ORG-CREATION P0 STILL UNVERIFIED. Nobody has watched a genuinely NEW user
  sign up.
- fanout.digital is NOT in Resend and RESEND_API_KEY is "placeholder" —
  noreply@/onboarding@fanout.digital would silently fail. No transactional
  email yet.
- Vercel team split deferred (20+ projects incl. client work in one team).
- 3 Clerk orgs across 5 profiles — org sprawl will confuse a real client.

## FRONTEND REDESIGN (John, not started in-repo)
John is redesigning the Fanout frontend. Evidence so far is ONE 8.5s phone
video of a monitor (OneDrive/CLAUDE BUILT APPS.../Fanout.Digital/IMG_5774.mov)
showing only a NEW LOGO: green fan/arrow mark on a dark rounded tile, lowercase
wordmark. The mark is good and would make a far better square profile picture
than the current 120x32 wordmark.
NOT ACTIONABLE AS-IS. To build it, need one of: the HTML he is working in
(local on his machine, C:/Users/fr...), a deployed URL, a Figma file, or
full-page screenshots at desktop + mobile widths.
Frontend lives in src/app/ (Next.js + shadcn). A redesign there is a real
build, not a paste.

## EMAIL / SOCIAL SETUP — DONE THIS SESSION, out of scope going forward
- info@fanout.digital and john@fanout.digital: shared mailboxes, forwarding,
  keep-a-copy. VERIFIED delivering (Brad confirmed receipt).
- DNS: MX -> fanout-digital.mail.protection.outlook.com, autodiscover CNAME,
  SPF merged preserving amazonses. All verified live via public resolver.
- social@nustack.digital created for all social account signups.
- Third M365 license purchased ($8.40/mo); John has a NuStack mailbox.
- Brand Info tabs filled in the client workbook; OneDrive/NuStack Brand Assets/
  created with per-brand folders + README.
- OPEN: john@fanout.digital still forwards to a personal Gmail. Repoint it to
  John's new NuStack mailbox — that removes the external hop that was causing
  Gmail to reject forwarded mail (Microsoft was accepting it all along;
  Resend reported the downstream forward failure as a bounce).

## TESTS
205 passing, 15 files. `npm test`. Several mutation-verified. See the
test-suite limitation above before trusting them for isolation claims.

## KEY FILES
  docs/audits/FANOUT-AYRSHARE-PARITY-PLAN.md    <- the plan + NATIVE decision
  docs/audits/FANOUT-CORRECTION-EXPOSURE-*.md   <- today's P1 findings
  scripts/check-inngest-health.mjs              <- npm run health:inngest

## NOTION
CC COMPLETE: 3e4663704e4081c1806dc470c7fd0c4d
Parity plan: 3e4663704e4081b5bf97f6e3ece3a240
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
