cd C:\Users\bradp\dev\fanout

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
1. Transient decrypt failures silently skip valid credentials.
   src/lib/crypto.ts:26 throws on ANY RPC error; the catch in
   src/inngest/functions/collect-inbox.ts turns every failure into a skipped row.
   CX proof (real Inngest SDK 3.54.0): 5 valid rows + a transient blip ->
   processed=0, transportCalls=0, and the memoized empty result blocked retry
   until the next cron. Need: corrupt rows skipped+logged, transient retried.
2. developer-apps UI callbackEnv is decorative.
   src/app/actions/save-platform-credentials.ts:72 persists only credential
   fields, so a user following that screen still gets authorize=503.
   Design change, not a tweak.
3. Inbox reply route marks FAILED sends as `replied`
   (src/app/api/dashboard/inbox/route.ts:100) -- 200 with zero transport calls.
   INHERITED, predates this work.
4. product_platform_accounts encrypt/read mismatch
   (social-setup/auto-connect:98 writes ciphertext vs cron/social-post-agent:130
   passes it straight through). Separate table. Relates to existing P1-9.
5. Instagram/Threads Meta redirect URIs still NOT in the Meta allowlist.
   Meta's combobox would not commit them after 3 attempts (stopped per the
   3-attempt rule). Not needed for Facebook-only pilot. IG also needs a
   Business/Creator account + an image on every post (instagram.ts:17).

## NOTION
CC COMPLETE:  https://app.notion.com/p/3e4663704e4081239e0bd9c0c9bc322f
Open Items:   collection://62ef8679-8772-4a64-b116-c6a731342913 (2 rows filed 2026-09-22)
CLAW_GATE_2_STATUS: PENDING -- CC set CLAIMED_DONE only. CFC is the sole VERIFIED_DONE authority.

## NOTE
Local `npm run build` fails at static prerender (missing Clerk key in the local
shell). PRE-EXISTING -- confirmed by stashing and rebuilding at HEAD. Vercel builds fine.
Use `npx tsc --noEmit` locally.
