# FANOUT — AGREED BUILD PLAN (CC + CX reconciled, 2026-09-22)

## END PROJECT GOAL (BUILD.md, authoritative — both agents agree)
Self-hosted Ayrshare replacement. ONE API call posts to 9+ platforms. Multi-tenant via Clerk orgs.
Roles in spec priority:
 1. INTERNAL INFRA — every NuStack engine calls /api/v1/post instead of paying Ayrshare ($2,995/mo @5 engines)
 2. AGENCY ENGINE BACKEND — provision profile+API key per client (POST /api/v1/profiles)
 3. STANDALONE SaaS — $199–499/mo, ICP agencies with 5–50 client accounts
 4. NuStack product marketing (CertusAudit, PocketPals) via product_platform_accounts

CX CORRECTION (accepted): "done" is NOT one successful post. Spec also requires tenant isolation,
token lifecycle, scheduling/retries, media, analytics, webhooks, AI gen/approval, agency provisioning,
dashboard. One post = first integration milestone, not completion. (BUILD.md:32,187,1009)

## THE BLOCKER — found by CX, independently verified by CC
`/api/v1(.*)` is in the Clerk protected matcher (src/proxy.ts:6). Fanout's own API keys are hex
strings, not Clerk JWTs, so EVERY machine caller is 307-redirected to /sign-in before reaching
verifyApiKey() (src/lib/auth.ts:23). Live proof:
  curl -H "Authorization: Bearer <key>" https://www.fanout.digital/api/v1/platforms
  -> 307 /sign-in, X-Clerk-Auth-Reason: token-invalid
=> Roles 1, 2 and 3 are ALL architecturally blocked. verifyApiKey() is dead code in production.
This outranks every OAuth/credential issue. CC's original P0 (Facebook first) was WRONG.

## AGREED SEQUENCE
P0-1  Exclude /api/v1 from the Clerk matcher; let verifyApiKey() run.
      GATE: valid key + no cookie -> 200 at handler; invalid key -> JSON 401 (not 307);
      key for profile A cannot act on profile B; expired sub -> 402.
P0-2  Fix tenant isolation in OAuth. authorize (route:18) checks userId but has ZERO org
      ownership check (CC verified: 0 org_id refs). select-page decrypts and returns FB page
      access_tokens by supplied profileId. Both use the service-role client.
      GATE: foreign-org profileId cannot create state, mutate tokens, or read page creds.
P0-3  Fix delivery correctness: missing-token path returns before writing post_results
      (fan-out.ts:78); retry cron emits social/post.retry but no function consumes it
      (retry-failed.ts:23 vs fan-out-post.ts:42, registry route.ts:15).
      GATE: failure persists a result row; retry re-sends ONLY the failed platform, no duplicate.
P0-4  THEN prove live: external engine -> /api/v1/post -> Inngest -> real Facebook Page ->
      post_results row with a real published post id. (Meta creds already validated live by CC.)
      Needs: a real FB Page + pages_manage_posts granted. App token alone is NOT proof.
P1-5  POST /api/v1/profiles (admin-key) reusing EXISTING key helpers
      (regenerate-key/route.ts:28) — CX correction: issuance/rotation already exist, do not rebuild.
P1-6  Verify FACEBOOK_CALLBACK_URL sharing: facebook, instagram AND threads all use it
      (oauth-config.ts:35,64,88) but callback matches on platform (callback:32) — IG/Threads state
      may be rejected. UNPROVEN, must be tested per-platform.
P1-7  Register real developer apps: LinkedIn, Twitter, Pinterest, YouTube (creds = literal
      "placeholder"). BLOCKING on Brad — OAuth login + platform review (days–weeks).
P1-8  Distributor correctness: Twitter + LinkedIn discard media; LinkedIn always posts as PERSON
      though the checklist wants company pages (docs:27); YouTube posts text to /youtube/v3/posts
      instead of videos.insert. (twitter.ts:7, linkedin.ts:20, youtube.ts:7)
P1-9  Product-marketing path is incompatible: OAuth writes oauth_tokens (callback:186) but the
      agent reads product_platform_accounts (social-post-agent:108). The doc's UPDATE activates
      nothing. Bluesky creds stored encrypted but passed raw to a distributor expecting JSON.
P1-10 Clerk pk_test_ -> pk_live_.
P2-11 Missing spec contracts: /api/v1/platforms/connect, /api/v1/webhooks/[platform],
      /api/v1/ai/generate, /api/v1/ai/approve. Also: spec shows /post returning platform results,
      impl returns only {queued} (BUILD.md:400 vs post:97) — reconcile the async contract.
P2-12 Real Sentry DSN (currently "PLACEHOLDER"); Anthropic key guard.
P2-13 Decide on out-of-spec dashboard pages. CX CORRECTION: approvals ARE spec'd
      (BUILD.md:594,1020) — CC wrongly listed it as creep. Re-scope before deleting anything.

## WHERE CC WAS WRONG (CX falsified, CC accepts)
- "done = one post" — too narrow.
- "13 distributors, 0 stubs" — 12 concrete + 1 abstract base; bluesky/mastodon/GBP analytics
  return empty objects. Real hostnames != complete implementation.
- G7 approvals-as-creep — approvals are spec'd.
- G9 Anthropic "hard dependency" — manual profile creation bypasses the agent entirely.
- G1/G2 "never happened" / "no dev app exists" — UNPROVEN. Empty tables aren't history
  (disconnect deletes tokens); oauth_state rows are written BEFORE the placeholder check,
  so they don't prove a real authorization attempt. Placeholder creds prove broken DEPLOYED
  CONFIG, not the absence of a console app.
- G10 trial-limit — a product opinion, not a spec violation.

## NEAR-TERM TARGET — DECIDED BY BRAD 2026-09-22
John Farmer uses Fanout for his own org + project as the FIRST REAL PILOT, to prove the
platform, then enhance it for non-NuStack clients. This is role 3 (standalone SaaS) reached
THROUGH a design-partner pilot — not role 1.

PILOT ACCOUNT: The Open Play Project (OPP) — https://opplv.org — Greater Las Vegas.
 - Youth after-school org: academics, STEM, health/wellness, youth mentorship. "Play to Learn"
   education-first gaming pathway. Permanent locations still coming.
 - STATUS CORRECTION: site footer states "A Nevada nonprofit IN FORMATION — not yet a
   501(c)(3). Contributions are not tax deductible at this time." Posts must NOT claim
   501(c)(3) status or tax-deductible giving.
 - Existing social: Facebook Page id=61591645414843 + Instagram @open.play.project ONLY.
 - Contact: support@opplv.org, text 702-831-0183.

WHY THIS FITS THE CURRENT STATE: OPP's only two platforms are Facebook and Instagram — exactly
the two whose credentials CC validated live this session. LinkedIn/X/TikTok placeholders do NOT
block the pilot.

IMPLICATION FOR SEQUENCING: as an external pilot user John exercises the DASHBOARD path
(connect -> compose -> post), not the machine API. So P0-1 (done) unblocks the product thesis,
but John's pilot depends on P0-2 (tenant isolation, done) and P0-3/P0-4.
INSTAGRAM CONSTRAINT: instagram.ts:17 requires >=1 media URL — text-only IG posts fail by design
(Meta rule). Facebook accepts text alone, so Facebook is the first test. IG also requires a
Business/Creator account linked to the FB Page.

## PROGRESS 2026-09-22
 P0-1 DONE + VERIFIED live. commit afa6812. /api/v1 + /api/cron removed from Clerk matcher.
      GATE PASSED: bogus key -> 401 {"error":"Invalid API key"} from verifyApiKey(), was 307 /sign-in.
      No regression: /dashboard still 307 -> /sign-in.
 P0-2 DONE (deployed, not yet adversarially tested). Ownership enforced in oauth authorize +
      select-page GET/POST via assertProfileOwned(profileId, orgId).
 P0-3 DONE + VERIFIED. commit 2b3079b, Vercel READY, function_count=15 live.
      (a) fan-out.ts early returns (missing token / unsupported platform) AND rejected
          allSettled promises now persist a failed post_results row.
      (b) retryPost consumer added for social/post.retry (events were previously discarded);
          retries ONLY the failed platform; event now carries profileId.
      (c) MIGRATION 016: post_results had NO unique(post_id, platform), so every upsert
          INSERTED a duplicate and `attempts` never worked. Constraint applied + verified live.
 MET A: John Farmer added as Meta Tester (Pending) on app 772426605937002 via Playwright.
 NEXT: P0-4 — live Facebook post to OPP's page once John accepts.


## P0-5 FOUND 2026-09-22 (VERIFICATION PASS) — INNGEST EVENT KEY IS INVALID
BLOCKER for John's pilot. Severity: equal to P0-1.

Evidence:
  - Vercel runtime log, /api/cron/collect-analytics -> 500
      "Inngest API Error: 401 Event key not found"
  - Direct probe, independent of the app:
      POST https://inn.gs/e/<INNGEST_EVENT_KEY>
      -> 401 {"error":"Event key not found","error_code":"event_key_not_found"}
  - Key is structurally plausible (65 chars) and NOT 
-corrupted, so the earlier env
    cleanup did not cause this. The key itself is wrong/revoked//from another environment.
  - /api/inngest reports has_event_key:true — that only proves the var is SET, not VALID.
    A "true" there is NOT evidence the key works.

Impact — this breaks POSTING, not just the analytics cron:
  - /api/v1/post:88          await inngest.send(...)
  - /api/dashboard/post:106  await inngest.send(...)  <- John's dashboard path
  - /api/dashboard/approvals:66,110 ; rss-feeds/trigger:26
  None are wrapped in try/catch. The post row is INSERTED first, then inngest.send() throws
  => user sees a 500, and a `pending` post row is stranded: never published, never retried
  (the retry cron only looks at post_results rows with status='failed', which never get written
  because fanOut never runs).

FIX REQUIRED before P0-4:
  1. Mint a valid Event Key in the Inngest dashboard for the `fanout` app (prod environment).
  2. vercel env rm/add INNGEST_EVENT_KEY (production) + redeploy.
  3. Re-probe inn.gs/e/<key> -> expect 200, not 401.
  4. Also verify INNGEST_SIGNING_KEY (signkey-prod-..., 77 chars) matches the SAME Inngest
     environment — a mismatched pair fails differently and is easy to miss.
  5. Consider wrapping inngest.send() so a queue failure marks the post failed instead of
     stranding it as `pending` behind a 500.


## P0-5 RESOLVED 2026-09-22
Root cause: the Production Event Keys list had NO key for fanout — only "Nustack digital",
"Little Roots Studio", "Vercel: content-engine", "Default ingest key". Fanout had been using a
key belonging to another project that was later rotated/revoked, hence 401 event_key_not_found.

Fix (done by CC via browser on Brad's logged-in Inngest session):
  1. Created a dedicated Production event key named `fanout` (NuStack Digital / Production).
  2. Validated BEFORE touching Vercel: POST inn.gs/e/<key> -> 200 {"ids":[...],"status":200}
  3. Swapped INNGEST_EVENT_KEY in Vercel production; read back byte-identical (86 chars), 0 corruption.
  4. Redeployed. /api/inngest -> function_count=15, event_key=true, signing_key=true.
  5. PROOF ON THE REAL PATH: the endpoint that was 500ing,
     GET /api/cron/collect-analytics with CRON_SECRET -> 200 {"triggered":true}

Lesson: /api/inngest reporting has_event_key:true proves the var is SET, not VALID.
Only an inn.gs probe or a real send distinguishes the two.

STILL RECOMMENDED (not yet done): wrap inngest.send() in the posting routes so a queue failure
marks the post failed instead of stranding it as `pending` behind a 500.
  /api/v1/post:88, /api/dashboard/post:106,112, /api/dashboard/approvals:66,110


## P0-6 DONE 2026-09-22 — QUEUE FAILURES ARE NOW VISIBLE
commit 0dff44e, Vercel READY, verified live.

New helper src/lib/enqueue.ts -> enqueuePostEvent(payload, {postId, platforms}).
On a send() throw it marks the post `failed` AND writes a post_results row per platform,
then the route returns 503 (not 500). Wired into the three user-facing creation paths:
  /api/v1/post, /api/dashboard/post (scheduled + immediate), /api/mobile/posts
Cron/internal routes intentionally left raw — they are machine paths with their own logging.

Why: this is exactly the P0-5 failure. A revoked event key stranded posts at `pending`
with no post_results row, so nothing published them and the retry cron could never see them.

## SWEEP RESULTS (same session, no defects found)
 - oauth_tokens has UNIQUE(profile_id, platform) -> the callback upsert is correct
   (contrast with post_results, which was MISSING its constraint — fixed in migration 016)
 - platform_page_id column EXISTS on oauth_tokens; fan-out.ts:106 reads it, select-page:183 writes it
 - callback routes facebook/instagram/threads to /select-page with correct onConflict
 - facebook.ts posts to /{pageId}/feed with message+access_token — correct for a Page post

## LIVE STATE AFTER THIS SESSION
 P0-1 machine API      bogus key -> 401 {"error":"Invalid API key"} (was 307 /sign-in)
 P0-2 tenant isolation ownership enforced in authorize + select-page GET/POST
 P0-3 delivery         failures persist on all paths; retryPost consumer registered
 P0-5 inngest          cron w/ CRON_SECRET -> 200 {"triggered":true}
 P0-6 queue failures   visible as failed + post_results, 503 not 500
 function_count=15, event_key=true, signing_key=true; all public routes 200; /dashboard 307


## SESSION 2026-09-22 (later) — JOHN STILL PENDING; THREE DEFECTS FOUND AND FIXED

STATE CHECK FIRST (no work started until measured):
  Meta app 772426605937002 roles: John Farmer = Tester, still **Pending**. Unchanged.
  Supabase jifhgpwiqgwkgqtmozsu: oauth_tokens=0, post_results=0, posts=0, profiles=2.
  => Steps 1 and 2 of the pilot are blocked on John, not on us. Verified, not assumed.

### P0-7 DONE + VERIFIED — META REDIRECT URI LIST WAS EMPTY (would have blocked John)
This contradicted the prior session's "nothing is blocking John."

Evidence (Meta's own Redirect URI Validator, not inference):
  Before: "This is an invalid redirect URI for this application"
  App had "Use Strict Mode for redirect URIs" = Yes with an EMPTY
  "Valid OAuth Redirect URIs" list. Strict mode allows only exact matches
  against that list, so every Meta authorization would have been rejected
  BY META, before Fanout ever saw the user.

Fix: added https://www.fanout.digital/api/oauth/facebook/callback to the app's
Valid OAuth Redirect URIs (Facebook Login for Business -> Settings). Saved.
  After (same validator, post-reload): "This is a valid redirect URI for this application"
  Persistence confirmed by reloading the page, not by the toast.

LESSON: the Tester-invite check answers "may he use the app", not "will the
redirect work". Two separate gates; only one had been checked.

STILL OPEN (deliberately not forced): the Instagram and Threads URIs would not
commit as chips in Meta's combobox after 3 attempts (typed text kept replacing
the prior pending entry rather than committing). Stopped per the 3-attempt visual
rule instead of fighting the widget. NOT a blocker for John: Facebook is his only
first test, Instagram additionally needs a Business/Creator account + an image per
post, and Threads is not in OPP's stack. Add them when Instagram is actually next.

### P0-8 DONE + VERIFIED — BLUESKY/MASTODON CREDENTIALS WERE PLAINTEXT AND UNPOSTABLE
commit 220414ae, Vercel READY.

fan-out.ts:105 calls decryptToken() on EVERY platform's token unconditionally,
but both manual connect routes wrote credentials in plaintext:
  bluesky/connect:51   access_token: JSON.stringify({identifier, password})
  mastodon/connect:52  access_token: accessToken
decrypt_token() is base64-decode-then-decrypt, so it THROWS on plaintext.
Proven live against the deployed function, not reasoned about:
  select decrypt_token('{"identifier":...}', 'k')
  -> ERROR 22023: invalid symbol "{" found while decoding base64 sequence

So repo CLAUDE.md's "✅ WORKING: Bluesky, Mastodon" was false — they were the
only two platforms claimed working, and both failed at the decrypt step.
Severity is bounded by P0-3: the throw is caught and persists a failed
post_results row, so it failed VISIBLY rather than silently.

Also removed plaintext app passwords / access tokens from the database.
Round-trip verified: decrypt_token(encrypt_token(json)) == original json,
so the distributors still receive the exact shape they expect.
Swept all 6 oauth_tokens writers; the other 4 already encrypted. Class closed,
not just the two paths noticed first. No stored rows to migrate (table empty).

### P1-6 RESOLVED — WAS "UNPROVEN", NOW PROVEN AND FIXED
commit 28ce2cc. CX's suspicion was correct.

FACEBOOK_CALLBACK_URL = "https://www.fanout.digital/api/oauth/facebook/callback"
— the path pins ONE platform. instagram and threads both pointed at it
(oauth-config.ts:64,88). The callback derives `platform` from the ROUTE SEGMENT
and matches oauth_state on it (callback:37), so an Instagram authorization would
return to the facebook route and query platform='facebook' against a state row
written as 'instagram' -> 0 rows -> misleading ?error=invalid_state.

Fix: instagram -> INSTAGRAM_CALLBACK_URL, threads -> THREADS_CALLBACK_URL.
Both env vars added to Vercel production, read back byte-identical
(55 and 53 chars, 0 literal-backslash-n corruption).
NOTE: these two also need their URIs in the Meta app list before use — see P0-7.

### NOT DONE THIS SESSION (stated plainly)
 - Notion session-start sync (steps 1-7) and CC COMPLETE / Open Items filings:
   still not run, now spanning 8 P0/P1 items and a schema migration.
 - P0-4 live Facebook post: cannot proceed until John accepts. Unchanged.


## CX REVIEW PASS 2026-09-22 — 4 MORE DEFECTS, ALL PRE-EXISTING
commit 7c44b2e. Review run read-only, effort=medium (banner verified).
Claim submitted: "these 3 commits are correct and complete."

### P0-9 INBOX SENT CIPHERTEXT AS A CREDENTIAL (reachable in John's pilot)
oauth_tokens.access_token is stored ENCRYPTED (121-char PGP blob, verified:
  select encrypt_token('EAAxxxFakePageToken123','k') -> 'ww0EBwMCAYyZxL3jX1h8...'
Neither src/inngest/functions/collect-inbox.ts (8+ call sites) nor
src/app/api/dashboard/inbox/route.ts imported decryptToken AT ALL. Both sent
the raw column value to Meta/Twitter/YouTube as a bearer token or access_token
query param. Every inbox poll and every reply was sending ciphertext.

collectInbox IS registered and live (1 of the 15 functions), so this fires as
soon as John connects his Page — not dormant code.

Fix: decrypt once at the fetch site in collect-inbox (so all downstream uses
get plaintext); decrypt at the call site in the reply route. Rows that fail to
decrypt are SKIPPED rather than sent as a garbage credential.

Swept all 4 readers of oauth_tokens.access_token: inbox, select-page,
collect-analytics, collect-inbox. collect-analytics already decrypted. Class closed.

### P0-10 SETUP UI TAUGHT THE BROKEN CALLBACK SHAPE  [found by CX, not CC]
src/app/dashboard/settings/developer-apps/page.tsx:124,147 told users to
register /api/oauth/facebook/callback for Instagram AND Threads — exactly the
misconfiguration 28ce2cc fixed in oauth-config.ts. Code was fixed; the UI that
instructs the human was not. scripts/test-enter-manual.mjs:48,51 had the same
stale mapping. Both corrected.

### P0-11 BLUESKY AGENT STORED THE WRONG SHAPE  [found by CX, not CC]
src/agents/account-creation/platforms/bluesky.ts:145 encrypted a BARE app
password. distributors/bluesky.ts:67 does JSON.parse(accessToken) expecting
{ identifier, password }. Every agent-created Bluesky account would have failed
at parse. Now stores JSON.stringify({identifier: handle, password: appPassword}).

LESSON (the reason CX caught these and CC did not): my writer sweep in P0-8
checked WHETHER each writer encrypted. It did not check WHAT SHAPE each writer
encrypted. "All 6 writers encrypt" was true and still left a broken writer.
Same column, same class, one level deeper. See memory/rule_one_reader_many_writers_must_agree.md.

### NOT REVIEWABLE BY CX
The Meta console redirect-URI allowlist (P0-7) is browser-only state, outside a
read-only repo review. It stays verified solely by CC + Meta's own validator.
