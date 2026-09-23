cd C:\Users\bradp\dev\fanout

## STATE 2026-09-23 — SIGN-IN IS LIVE. PILOT-READY. ONE GATE LEFT: JOHN.

Clerk is fixed. Deploy is green. All code + DB fixes are live and verified.
The ONLY remaining gate is John Farmer accepting the Meta Tester invite.

## FIRST COMMAND — confirm still healthy
  curl -s -o /dev/null -w '%{http_code}\n' https://clerk.fanout.digital/v1/environment
  200 = sign-in works. (Was 000 all of 2026-09-22 evening.)

## WHERE IT STANDS
Head 016a0c0 · Deploy dpl_J8QXJnAoHWdxTbkoLLVU7evLJy5j READY
Supabase jifhgpwiqgwkgqtmozsu · oauth_tokens=0, post_results=0, profiles=2

NEXT ACTION: John accepts Meta Tester invite (app 772426605937002), then runs
the 7-step instruction set (in the session transcript + CC COMPLETE page).
Verify him SERVER-SIDE, never by his word:
  select count(*) from oauth_tokens;   -- expect 1
  select * from post_results;          -- expect a real platform_post_id
  select * from inbox_items;           -- comments (collect-inbox cron is */15)

## SHIPPED 2026-09-22 (all live)
- F1 306c278e — decryptToken split into TokenCorruptError (skip+log) vs
  TokenDecryptUnavailableError (rethrow -> Inngest retries). Classifier verified
  against the LIVE db: wrong key=39000, malformed=22023, round-trip still true.
- F2 306c278e — all 5 reply transports now call assertDelivered(). fetch()
  resolves on 403; NONE of them checked res.ok, so a rejected reply returned 200
  and the item was marked 'replied'. Route now returns 502 and leaves it queued.
- F3 306c278e — step counts read from step.run return values, not a closure
  lost on replay.
- Migration 017 3433d7f — anon held SELECT/INSERT/UPDATE/DELETE on EVERY table
  incl oauth_tokens and two_factor_codes, with RLS the only barrier. Anon now
  denied at the GRANT layer. short_links keeps its public read. service_role
  still reads real data (profiles=2, org_subscriptions=3).
- Organizations ENABLED on both Clerk instances (see below).
- 016a0c0 — clean rebuild on restored pk_live_ keys.

## TWO BLOCKERS RESOLVED — DO NOT RE-INVESTIGATE
1. CLERK DOMAIN. Prod vars held literal placeholders "pk_test_..."/"sk_test_..."
   copied from .env.local.example lines 11-12. Six deploys ERRORed. Brad supplied
   live keys (pair match PROVEN: secret's instance owns fanout.digital with
   frontend_api_url https://clerk.fanout.digital = what the pk decodes to).
   Domain then sat Unverified 3.5h. RESOLVED when Brad's Verify Records click
   finally registered at 02:10:23Z — updated_at moved for the first time and the
   cert issued seconds later.
   FALSIFIED: CX's "Deploy certificates step" (CFC proved no such control exists
   on Hobby plan). CC's "resolves on its own" (it waited indefinitely on a click).
2. ORGANIZATIONS DISABLED on BOTH instances. 48 of 48 API routes 401 without an
   orgId. Would have broken the pilot even with the cert working. Also disabled
   the recovery UI: dashboard/page.tsx:42-55 renders Clerk's <OrganizationList>
   for org-less users, which needs the instance flag. Nothing in the codebase
   calls createOrganization — getOrCreateOrgSubscription(orgId) takes the org as
   a PARAMETER and creates only the DB row. One flag gated all onboarding.
   Now enabled + verified on both (GET /v1/organizations = 200, was 403).

## CLERK INSTANCE TOPOLOGY
prod ins_3JhcXd7I0OQpSeT0fruGzXyzw1j — clerk.fanout.digital — 0 users
dev  ins_3IhEypzXMtuuxDT2lKynugOPhzk — notable-dolphin-1159 — 3 users incl
     frr.joh.1@gmail.com (John). NOT the same as the older rich-chow-70 instance
     that the last good build 76534f8 shipped.
John's old account is on DEV. The live site uses PROD. He must SIGN UP FRESH —
do not issue him credentials.

## STILL OPEN (held deliberately, off the pilot path)
F4 developer-apps callbackEnv decorative (save-platform-credentials.ts:72)
F5 product_platform_accounts encrypt/read mismatch — separate table, unused
F6 Instagram/Threads Meta redirect URIs — browser-only Meta console state

## NOTION
CC COMPLETE:  3e4663704e4081ffa9dcc66c47be4de9
Work Queue:   3e4663704e4081ffbc20e678b235598f  (State = BUILDING)
Active Seq:   360663704e408103b843ca3fc822e450  (fanout block, 85%)
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
Two eval-gate checks (F1/F2 runtime) stay DEFERRED until a real account exists.
