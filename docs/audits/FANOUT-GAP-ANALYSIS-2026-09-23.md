# FANOUT — GAP ANALYSIS TO COMPLETION — 2026-09-23
Measured against HEAD 1410ee8c, live prod, and live DB. Not re-derived:
this scores the reconciled CC+CX plan (FANOUT-BUILD-PLAN-2026-09-22.md).

## WHAT "COMPLETE" MEANS (BUILD.md, authoritative)
Self-hosted Ayrshare replacement. ONE API call -> 9+ platforms, multi-tenant
via Clerk orgs. Four roles in spec priority:
 1 INTERNAL INFRA    — NuStack engines call /api/v1/post (replaces $2,995/mo Ayrshare)
 2 AGENCY BACKEND    — provision profile + API key per client
 3 STANDALONE SaaS   — $199-499/mo, agencies w/ 5-50 client accounts
 4 PRODUCT MARKETING — NuStack products via product_platform_accounts
Completion is NOT one successful post. It is tenant isolation + token lifecycle
+ scheduling/retries + media + analytics + webhooks + AI gen/approval + agency
provisioning + dashboard.

## SCORECARD — 13 plan items measured against code

DONE (live-proven this session)
 P0-1 /api/v1 excluded from Clerk matcher .... DONE. Live: bogus key ->
      {"error":"Invalid API key"} HTTP 401 (JSON, not a 307 to /sign-in).
      verifyApiKey() is no longer dead code. Unblocks roles 1, 2, 3.
 P0-2 OAuth tenant isolation ................ DONE. select-page/route.ts:18
      assertProfileOwned(profileId, orgId) + auth() orgId at :30 and :118.
 P0-3 retry consumer ........................ DONE. retry-post.ts consumes
      social/post.retry and IS registered (api/inngest/route.ts:22).
 P1-10 pk_test_ -> pk_live_ ................. DONE. pk_live_ served in prod.
 P1-7 placeholder creds ..................... APPARENTLY DONE (no "placeholder"
      left in oauth-config.ts) — but per-platform live auth is UNPROVEN.
 P2-12 Sentry DSN ........................... DONE (no PLACEHOLDER left).

OPEN — blocking full product
 P1-5  POST /api/v1/profiles ................ MISSING. No src/app/api/v1/profiles.
       => Role 2 (agency provisioning) cannot be done via API at all.
 P1-8  Distributor correctness .............. PARTIAL.
       - LinkedIn always posts as PERSON (linkedin.ts:20 urn:li:person) though
         the agency use case needs company pages.
       - YouTube posts text to /youtube/v3/posts (youtube.ts:14) not videos.insert.
 P1-9  Product-marketing path broken ........ OPEN (= F5). OAuth callback writes
       oauth_tokens (callback:154,186); the agent reads product_platform_accounts
       (social-post-agent:109). Two tables. Role 4 activates nothing.
 P2-11 Missing spec contracts ............... 4 MISSING: /api/v1/platforms/connect,
       /api/v1/webhooks/[platform], /api/v1/ai/generate, /api/v1/ai/approve.
       Present: post, schedule, platforms, platforms/status, platforms/[platform],
       analytics/[postId].
       Also unreconciled: spec says /post returns platform results; impl returns
       {queued} only. The async contract is undecided.
 P2-13 Out-of-spec dashboard pages .......... UNDECIDED (approvals ARE spec'd —
       do not delete).

NOT ON THE PLAN — found this session
 NEW-1 NO TEST SUITE. package.json has build + lint only. Zero test runner,
       zero tests, for 88 API routes and 13 distributors. This is the single
       largest completion gap: nothing can be regression-proven.
 NEW-2 Latent auth-bypass class (P2, currently UNREACHABLE). oauth-apps-list:10
       and register-oauth-app:23 grant on
       `req.headers.get('x-admin-key') === process.env.FANOUT_ADMIN_KEY`.
       FANOUT_ADMIN_KEY IS set in prod (both return 401 with no header), so this
       is not live — but it fails open if the var is ever unset. Contrast
       lib/auth.ts:13-16 which guards unset with a 500. Harden to match.
 NEW-3 README is still the stock create-next-app boilerplate.

## FALSIFIED THIS SESSION — do not re-file
 - "/api/dashboard/profiles returns 200 unauthenticated" — that 200 is the
   SIGN-IN PAGE. auth.protect({unauthenticatedUrl}) redirects to /sign-in,
   which is a 200. Middleware works.
 - "34 routes missing auth" — a grep artifact. They authenticate by shared
   secret (FANOUT_ADMIN_KEY / FANOUT_ENGINE_KEY / INTERNAL_API_KEY). All probed
   401 live, POST included, against a 404 control.
 - "distributors don't check res.ok" — base.ts fetchJson returns {ok,...} and
   every distributor destructures it. Bluesky's 2 raw fetches both check .ok.

## SEQUENCE TO COMPLETION (CC recommendation)
 S1 Pilot proof (in flight)   — John: oauth_tokens>=1, a real platform_post_id.
 S2 NEW-1 test suite          — smoke per v1 route + per distributor. Nothing
                                below is safe to build without it.
 S3 P1-5 POST /api/v1/profiles— unlocks role 2; reuse regenerate-key helpers.
 S4 P1-9 table mismatch       — unlocks role 4; one reader, one table.
 S5 P2-11 four contracts + async contract decision — completes the public API.
 S6 P1-8 LinkedIn org pages + YouTube videos.insert.
 S7 NEW-2 harden, NEW-3 README.

## CX REVIEW 2026-09-23 — ITS P0 IS FALSIFIED
CX (gpt-6-astra, effort=high) returned "P0 FIRST PROOF: /api/v1 still behind
Clerk", quoting HTTP 307 -> /sign-in with X-Clerk-Auth-Reason: token-invalid,
and graded the product NO-GO on that basis.

MEASURED, both hosts, headers shown:
  apex  https://fanout.digital/api/v1/platforms      -> 308 -> www   (redirect only)
  www   https://www.fanout.digital/api/v1/platforms  -> 401
        body: {"error":"Invalid API key"}
That body is Fanout's OWN string from src/lib/auth.ts verifyApiKey(). Clerk does
not emit it. A 64-hex-shaped key returns the same 401 from the same verifier.

CX's error: it tested the APEX, which 308-redirects, and it read the
X-Clerk-Auth-* headers as proof of a redirect. Those headers are attached by
clerkMiddleware to EVERY request, including this 401 — they describe the session,
not the disposition. P0-1 stands DONE.

LESSON (generalizable): on a site with an apex->www redirect, a probe that does
not follow redirects measures the redirect, not the route. And a vendor's
diagnostic headers are not a status code.

## CX AUDIT RESULTS — 2 of 3 runs usable
Run 1 (the full 97-line dispatch): exit 0, intent line only, NO verdict —
the documented CX long-prompt failure. Short single-demand prompts worked.
Re-dispatch as focused single questions, never as a long file.

CONFIRMED + FIXED — P1 unauthenticated write (CX found it, CC missed it)
 POST /api/webhooks/inbound-sms had no Twilio signature validation and inserted
 into two_factor_codes with the SERVICE-ROLE client. PROVEN LIVE: an unsigned
 curl POST wrote row e6a261f3 to production (deleted; table back to 0).
 Migration 017 closed the anon GRANT layer; this route bypassed it by holding
 service_role — the "invariants go where service role cannot bypass" lesson.
 Reader is /api/admin/2fa-codes, so a seeded code could be consumed by an admin
 during account creation.
 FIXED 58ef783: HMAC-SHA1 over URL + sorted params, timing-safe, fails CLOSED
 when TWILIO_AUTH_TOKEN is unset. Safe to ship: prod has NO Twilio vars, so this
 webhook was never wired to a live number.

FALSE POSITIVE — CX A4 "Bluesky and Mastodon writers store plaintext"
 Both live in _Social-Media-Engine/, which is gitignored, untracked (git ls-files
 = 0), never deployed, and imported by nothing in src/. CX audited a local
 scratch copy. Main-app writers encrypt correctly.
 LESSON: scope an agent to tracked, deployed code or it will audit vestiges.

FALSIFIED — CX P0 "/api/v1 still behind Clerk" (see section above)

## APEX-CANONICAL — DONE 9b1f252, live-verified
 fanout.digital now serves directly (401 from verifier, no redirect);
 www.fanout.digital 308s to apex. Reverse of before.
 Removes the trap that caused CX's P0 misdiagnosis.
 OAuth callback env vars deliberately LEFT on www — a redirect URI must match
 each provider console exactly and John's Meta connection is imminent. www still
 301s so registered URIs stay valid. Flip once consoles are updated.

## CFC VISUAL AUDIT — 2026-09-23 (deploy 1227f7e)
VERDICT: NOT PILOT-READY. Headline check PASSED — the Clerk widget renders on
/sign-in and /sign-up at all 4 viewports, no blank box, no handshake errors.
Every signed-in page renders an HONEST empty state (no spinner-forever, no NaN,
no chart with no data). CFC correctly declined to create an account.

FIXED THIS SESSION (6d9d85a)
 CFC#2 /dashboard/social exposed to tenants. Root cause was worse than the UI:
   /api/social-status and /api/social-queue checked only that SOME orgId existed,
   never WHICH, and queried social_posts_queue with NO org filter. Any tenant
   could read AND WRITE NuStack's product queue, and see the Meta App ID.
   Fixed: new src/lib/nustack-admin.ts (one definition, replacing two identical
   private copies), both routes 404 for non-staff, sidebar link moved to
   INTERNAL_NAV. Also closed the env-unset bypass in the old copies.
 CFC#4 No sign-in link below 640px — 'hidden sm:flex' on HomeClient. A returning
   pilot user on a phone had no way to log in. Now always visible.

OPEN — NEEDS BRAD, NOT CC
 CFC#3 Starter plan contradicts itself: pricing card says "All 9 platforms",
   comparison table and billing page say 5. FAQ says AI generation is on all
   plans; the table shows "—" for Starter.
   IMPORTANT: no platform limit is enforced ANYWHERE in code (no maxPlatforms,
   no gate). Plan limits exist only as UI strings in dashboard/billing/page.tsx.
   So this is a product decision + a missing enforcement, not a copy typo.
 CFC#5 /privacy and /terms "Last updated" = today's UTC date, both ~1,700 chars.
   Counsel's call. No agent edits.
 CFC#1 ORG CREATION STILL UNVERIFIED — the actual pilot P0. Nobody has observed
   what an org-less user sees. Brad's account already has an org. Requires a
   fresh sign-up with CFC watching.

## NEW-1 TEST SUITE — DONE (77e8556)
 67 tests, 5 files, ~180ms, no network. vitest. npm test.
 Each suite guards a failure that actually shipped:
  twilio-signature(8) · nustack-admin(9) · decrypt-token/F1(14) ·
  distributor-base/F2(11) · distributor-contract(25)
 Mutation-verified: breaking the validator fails 2 tests; restoring passes 8.
