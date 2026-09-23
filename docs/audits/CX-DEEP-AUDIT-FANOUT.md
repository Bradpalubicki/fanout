# CX DEEP AUDIT — FANOUT — 2026-09-23

REPO: C:\Users\bradp\dev\fanout
HEAD: 1410ee8c0eb7f89294026138edbf9b33179fb01f
PROD: https://www.fanout.digital  (apex 308-redirects to www — always use www)
DEPLOY: dpl_DFoYaXC4rro1mfH7adfQhrrteWb4 READY, SHA matches HEAD
DB: Supabase jifhgpwiqgwkgqtmozsu

## SCOPE
Read-only code audit. Do NOT edit files. Do NOT commit. Do NOT deploy.
Output findings only. One claim per finding, each with a discriminating
failure condition (what observation would have FALSIFIED it).

## GROUND TRUTH ALREADY ESTABLISHED — DO NOT RE-DERIVE
These were measured live this session. Treat as given; contradicting them
requires new evidence, not re-assertion.

1. Clerk sign-in is LIVE. clerk.fanout.digital/v1/environment = 200.
   pk_live_Y2xlcmsuZmFub3V0LmRpZ2l0YWwk is served in prod HTML.
2. Apex fanout.digital 308-redirects to www.fanout.digital. Any probe that
   does not follow redirects returns 308 for EVERY path including
   nonexistent ones. A bare 308 is not a result.
3. Unauthenticated probes, redirects followed, control route
   /api/nonexistent-control-route = 404 (so codes below are real):
   - /api/admin/2fa-codes 401 · /api/mobile/* 401 · /api/agency/status 401
   - POST /api/agency/snapshot, /api/fanout/jobs, /api/internal/account-creation,
     /api/admin/check-oauth-apps, /api/engine/submit = all 401
   - /api/health 200 (intentional)
   - /api/dashboard/profiles "200" is the SIGN-IN PAGE HTML, not the API.
     middleware auth.protect({unauthenticatedUrl}) redirects to /sign-in which
     is a 200 page. Do not report this as an auth bypass.
4. FANOUT_ADMIN_KEY IS set in prod: /api/admin/oauth-apps-list and
   /api/admin/register-oauth-app both return 401 with no header.

## WHAT TO AUDIT — ranked, highest value first

### A1. Env-unset auth bypass class (latent, currently unreachable)
src/app/api/admin/oauth-apps-list/route.ts:10 and
src/app/api/admin/register-oauth-app/route.ts:23 authorize with:
    if (req.headers.get('x-admin-key') === process.env.FANOUT_ADMIN_KEY) return true
A missing header yields null, not undefined, so today this denies. But confirm
across ALL secret comparisons whether any code path can make both sides equal
(undefined===undefined, ''==='', null coercion). Compare against
src/lib/auth.ts:13-16 verifyInternalKey, which guards the unset case with a 500.
CLAIM ONLY IF you can state the exact env state that opens it.
FALSIFIED IF: every comparison either guards unset or cannot be made equal.

### A2. The 88 API routes vs the 7-entry middleware matcher
src/proxy.ts protects only /dashboard, /api/dashboard, /api/reports,
/api/upload, /api/setup, /api/links, /api/biolink. 81 routes sit outside it
and must self-verify. Enumerate EVERY route outside the matcher and classify
its own auth: Clerk auth(), verifyApiKey, CRON_SECRET, shared secret, or NONE.
Report any route reaching Supabase or an external API before an auth check.
FALSIFIED IF: every unmatched route has a verifier before its first side effect.

### A3. orgId scoping — cross-tenant read/write
Organizations were only just enabled; 48 routes require an orgId. For routes
that resolve an org, verify the org comes from the SESSION and not from a
request body/query param a caller controls. A route taking orgId from input
is a cross-tenant leak.
FALSIFIED IF: every org-scoped query derives orgId from auth(), never input.

### A4. Token encryption — one reader, many writers
decryptToken (F1, commit 306c278e) is the single reader and splits
TokenCorruptError (skip+log) from TokenDecryptUnavailableError (rethrow).
Grep EVERY writer into oauth_tokens and confirm all encrypt with the same
key/algorithm the reader expects. A writer storing plaintext breaks that
platform silently at fan-out time. oauth_tokens is currently EMPTY (0 rows),
so this cannot be caught at runtime yet — it must be caught by reading.
FALSIFIED IF: all writers route through the same encrypt helper.

### A5. Completion gaps — audit against BUILD.md
Read FANOUT-BUILD-PLAN-2026-09-22.md and docs/audits/FANOUT-GAP-ANALYSIS-2026-09-23.md
first. CC measured P0-1/2/3, P1-7, P1-10, P2-12 as DONE and these as OPEN:
 - P1-5  POST /api/v1/profiles MISSING entirely -> role 2 impossible via API.
 - P1-9  callback writes oauth_tokens (callback:154,186); social-post-agent:109
         reads product_platform_accounts. Two tables -> role 4 activates nothing.
 - P1-8  linkedin.ts:20 always urn:li:person; youtube.ts:14 posts text to
         /youtube/v3/posts, not videos.insert.
 - P2-11 /api/v1/platforms/connect, /webhooks/[platform], /ai/generate,
         /ai/approve all MISSING. And spec says /post returns platform results
         while impl returns {queued} — async contract unreconciled.
CONFIRM OR FALSIFY each. Then answer what CC cannot: what else does BUILD.md
require that is absent from the code AND absent from that list?
FALSIFIED IF: a remaining item is already implemented where CC did not look.

NOTE — CC ALREADY FALSIFIED THESE. Do not re-file:
 - "distributors ignore res.ok": base.ts fetchJson returns {ok,...}; every
   distributor destructures it; bluesky's 2 raw fetches both check .ok.
 - "34 routes missing auth": shared secrets; all probed 401 live vs a 404 control.
 - "/api/dashboard/profiles 200": that is the sign-in page, not the API.

### A6. No test suite exists
package.json has build and lint only — zero test script, no test runner.
Report what minimum coverage a pilot needs, ranked. Do not write the tests.

## OUTPUT FORMAT
For each finding:
  SEVERITY: P0|P1|P2
  FILE:LINE
  CLAIM: one sentence
  FAILURE SCENARIO: concrete inputs/state -> wrong outcome
  DISCRIMINATING FAILURE CONDITION: what would have falsified this
End with a single line: VERDICT: <one paragraph overall>
