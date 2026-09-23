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
