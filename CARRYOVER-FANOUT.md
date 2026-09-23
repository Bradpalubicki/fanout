cd C:\Users\bradp\dev\fanout

## 🔴 READ FIRST — DEPLOYS ARE BLOCKED (found 2026-09-22, needs Brad)
Production Clerk key is `pk_test_` and is now INVALID. Every Vercel build fails:
  "Error: @clerk/clerk-react: The publishableKey passed to Clerk is invalid. (key=pk_test_...)"
  "Export encountered an error on /_not-found/page, exiting the build."
A DOCS-ONLY commit failed -- that is the proof it is environmental, not code.

Live site is FINE: it still serves the last good deploy 76534f8, which contains
every code fix from this session. Only the trailing docs commits are unshipped.
Verified live: / =200, /api/inngest function_count=15, bogus key -> 401, /dashboard -> 307.

NEEDS BRAD: mint pk_live_ + matching CLERK_SECRET_KEY from the SAME Clerk instance
(OAuth login, CC cannot). Then CC sets them via `vercel env` and redeploys.
Notion: https://app.notion.com/p/3e4663704e4081d6b18fca7761afe6b7


Read FANOUT-BUILD-PLAN-2026-09-22.md (end of file = current state).

## WHERE THINGS STAND
John Farmer is STILL PENDING on the Meta Tester invite for app 772426605937002.
Nothing in the product blocks him any more. Facebook connect -> post will work
when he accepts. Verify server-side, not by his word:
  select count(*) from oauth_tokens;   -- expect 1 after he connects
  select * from post_results;          -- expect a real platform_post_id
Supabase project: jifhgpwiqgwkgqtmozsu

## DO NOT REDO
- Meta Facebook redirect URI IS registered and passes Meta's own validator.
- oauth_tokens is EMPTY (0 rows) -- no plaintext migration needed.
- All 6 writers / 4 readers of oauth_tokens.access_token now agree on BOTH
  encryption AND payload shape. CX round 2 confirmed this explicitly.
- Bluesky agent payload verified against the official AT Protocol
  createSession lexicon: a handle IS a valid `identifier`.

## OPEN, IN PRIORITY ORDER
1. developer-apps UI callbackEnv is decorative.
   src/app/actions/save-platform-credentials.ts:72 persists only credential
   fields, so a user following that screen still gets authorize=503.
   Design change, not a tweak.
2. product_platform_accounts encrypt/read mismatch
   (social-setup/auto-connect:98 writes ciphertext vs cron/social-post-agent:130
   passes it straight through). Separate table. Relates to existing P1-9.
3. Instagram/Threads Meta redirect URIs still NOT in the Meta allowlist.
   Meta combobox would not commit them after 3 attempts (stopped per the
   3-attempt rule). Not needed for the Facebook-only pilot. IG also needs a
   Business/Creator account + an image on every post (instagram.ts:17).

CLOSED 2026-09-22 in 306c278 (do NOT redo): transient-vs-corrupt decrypt
classification, false-success inbox replies (res.ok now checked on all 5
transports), and a replay-unsafe totalNew counter.

ALSO DONE (do NOT redo): migration 017 (commit 3433d7f) revoked unused anon
grants and IS APPLIED TO PROD. Re-verified live: 0 anon writes schema-wide,
0 anon SELECT on oauth_tokens, short_links still anon-readable (deliberate,
public redirects), service_role still reads profiles=2 / org_subscriptions=3.
The DB change is live regardless of the Clerk deploy blocker.

## NOTION
CC COMPLETE:  https://app.notion.com/p/3e4663704e4081239e0bd9c0c9bc322f
Open Items:   collection://62ef8679-8772-4a64-b116-c6a731342913 (3 rows filed 2026-09-22)
CLAW_GATE_2_STATUS: PENDING -- CC set CLAIMED_DONE only. CFC is the sole VERIFIED_DONE authority.

## NOTE
Local `npm run build` fails at static prerender (missing Clerk key in the local
shell). PRE-EXISTING -- confirmed by stashing and rebuilding at HEAD. Vercel builds fine.
Use `npx tsc --noEmit` locally.
