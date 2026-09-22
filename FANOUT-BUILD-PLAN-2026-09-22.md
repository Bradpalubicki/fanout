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
 NEXT: P0-3 (failure/retry correctness), then P0-4 live Facebook post for OPP.
