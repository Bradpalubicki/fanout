cd C:\Users\bradp\dev\fanout

Read the DECIDE block before touching code. Two items need Brad to answer, and
one is a CRITICAL security patch already written but deliberately unpushed.

## DECIDE FIRST - blocked on Brad, not on code

1. CLERK CRITICAL AUTH BYPASS - 9 repos still exposed.
   GHSA-vqx2-fgx2-5wq9 (middleware route-protection bypass) + GHSA-w24r-5266-9c3c
   (org/billing/reverification authorization bypass). Vulnerable: @clerk/nextjs
   <= 6.39.2. Clerk middleware gates every protected route, so this IS the auth
   boundary. 6.39.3+ fixes it - a patch bump inside v6, NOT a major upgrade.

   EXPOSED (v6, locked version): fanout 6.39.0, agency-engine 6.37.5,
   menshealth-engine 6.37.1, littleroots-studio 6.37.3, reveal-app 6.37.5,
   mindstar-counseling 6.37.1, ak-dental-website 6.39.0, accounting-engine 6.39.5.
   CLEAN (v7, out of range): wellness-engine, sendpaid, equipment-rental-engine,
   compliance-engine.

   Per repo: npm install @clerk/nextjs@"^6.39.7" --save --legacy-peer-deps
             npm run build && npx tsc --noEmit    then commit + push.
   Ask Brad before batching 9 production deploys.

2. website-engine commit 00e1b20 is UNPUSHED, on purpose.
   Patches the same Clerk CVE + inngest 3.52.0 -> 3.54.2. Vercel had REFUSED to
   deploy on the vulnerable inngest: "Vulnerable version of inngest detected
   (3.52.6). Please update to version 3.54.0 or later." Verified there:
   npm audit CLERK CLEAN, criticals 4->2, highs 35->32, tsc exit 0.
   NOT pushed because website-engine is outside the repo this session worked in
   and pushing auto-deploys to production. Brad decides.
   Its CLAUDE.md + 2 untracked files belong to Brad - do not commit them.

3. RESEND - blocked on spend. fanout.digital is NOT in Resend and
   RESEND_API_KEY is the literal string "placeholder", so all 7 send sites fail
   SILENTLY (noreply@ x5, onboarding@ x2). Creating the domain returns
   403 "You have reached the domain limit of your plan." Deleting
   veteransthrive.org freed a slot (20->19) and it STILL 403s, so the real cap is
   below 19 and the existing domains are grandfathered. Needs, in ONE message:
   exact amount, vendor (Resend), and the words "confirm spend".
   SPF already includes amazonses.com, so post-upgrade it is ~10 min: create
   domain -> DKIM into GoDaddy (needs a gd_pat_ PAT, NOT on this machine) ->
   verify -> mint key -> vercel env add -> redeploy -> live send + read the
   delivery status back.

## STATE - fanout is green, d31acbf live

  HEAD d31acbf, SHA confirmed on remote, Vercel dpl_6FtcFKNVf4eG READY.
  Live: function_count=17, bogus API key -> 401, / -> 200.
  Tests 406 passing / 35 files. tsc clean. 0 eslint errors.
  Working tree clean except BIBLE-UPDATE-NEEDED.md - that file belongs to BRAD,
  untouched all session (auto-generated changelog noise, not a work item).
  Never commit it.

## DONE THIS SESSION - do not redo

  030472f  prompt caching on setup-agent (tools+system = 1903 tok prefix).
           Marker on the LAST TOOL, not system: tools order BEFORE system, and
           SYSTEM alone is 398 tok - under the 1024 minimum, so a marker there
           caches NOTHING. Proven live: cache_read 1189 on every repeat call.
           Skipped 10 other call sites - measured, not assumed (ai/draft 243 tok,
           generator skeleton 161 tok, the rest have no fixed prefix at all).

  Seven defects from a CX audit, closed and CX-AGREED at 469d2b9:
  5cda6ca  1 the credential action was a PROD-CONFIG ESCALATION (any signed-in
             user could write arbitrary Vercel production env vars) -> now
             isNuStackAdmin + an allowlist derived from PLATFORMS so the two
             cannot drift
           2 cancelled scheduled posts published anyway -> DB recheck after
             sleepUntil. Reschedule emits NO new event, so it fired at the OLD time
           3 all 7 post_results upserts named no conflict target
           4 increment_post_attempts DID NOT EXIST -> migration 020 + error check
           5 Sentry enabled on an invalid DSN ("placeholder" is truthy)
  c4f551b  CX rejected 2 and 4. Both were MY OWN defects: a 60s tolerance window
           published early by its own width (+30s reschedule still fired), and
           sendEvent ran BEFORE the increment so a failing RPC emitted uncapped
           retries. Fixed; CX then AGREED on all five.
  a849913  closed the two residual notes (discarded write errors, literal-only
           DSN blocklist)
  41f9630  CX rejected both residuals again - also correct. The helper handled a
           RETURNED error but not a REJECTED promise; the DSN check was
           protocol-only AND validated a trimmed copy of a value passed untrimmed.
  469d2b9  THE ONE WORTH READING: all three sentry configs had SHIPPED a regex
           with the backslash MISSING from the digit class - which INVERTS the
           check (valid "456" false, invalid "d" true). Eight green tests never
           noticed, because the test re-declared the validator BY HAND and the
           copy was correct. A mirror only tests itself. Tests now EXTRACT
           isUsableDsn from each real config file and evaluate it.
           CX: AGREE on all seven.

  d31acbf  migration 021 - decrypt_token/encrypt_token were granted to anon,
           i.e. callable UNAUTHENTICATED at /rest/v1/rpc/decrypt_token. Also
           corrects 020: its REVOKE ... FROM PUBLIC left authenticated=X
           standing, because revoking PUBLIC does not drop an explicit role
           grant. All three verified anon=f authenticated=f service_role=t.

## HOW TO VERIFY - this repo has been burned by every one of these

1. Mutation-check every test. Break the thing, confirm RED, restore, diff
   byte-identical. And test the ARTIFACT, never a hand-copy of it - see 469d2b9.
2. pgrep DOES NOT EXIST in Git Bash. An "until ! pgrep -f X" loop exits
   instantly and makes a running job look finished. It made me call a working CX
   audit "failed" three times. Wait on the artifact instead:
   until grep -q "tokens used" out.txt; do sleep 20; done
3. Heredocs eat backslashes. That is how the inverted regex shipped. Build them
   with String.fromCharCode(92) and read the bytes back off disk to confirm.
   A single apostrophe inside a nested heredoc also breaks the outer quoting -
   write long files with a script file, not inline.
4. Never parse Vercel CLI output - use mcp__claude_ai_Vercel__get_deployment and
   read state + meta.githubCommitSha. Also "cmd | tail" reports the exit code of
   TAIL, not of the command.
5. After every push, confirm the SHA landed with git ls-remote origin main.
6. This repo is CRLF. Normalize before splicing, write back as CRLF.
7. The commit-message hook rejects the -m "$(cat ...)" form. Use git commit -F -.

## ERROR SWEEP - what is actually broken out there

  Tool written and working:
  node /c/Users/bradp/dev/fleet-status/scripts/sentry-watch.mjs
  (needs SENTRY_AUTH_TOKEN in env; silence means clean). README sits beside it.

  FANOUT IS BLIND: there is NO fanout project among the 22 in Sentry, and the DSN
  is "PLACEHOLDER". No Sentry errors for fanout means nothing is being reported,
  not that nothing is wrong. Worth creating.

  Known baseline (do NOT re-report these as new):
    agency-engine     2 issues / 9860 ev - N+1 on /api/cron/deploy-health-monitor
    courtcase-search 36 issues / 1649 ev - incl. REAL bugs: column
                       case_notifications.viewed_at does not exist, and
                       FeatureTier has no attribute BASIC
    flipiq           22 issues /  199 ev - UNRESERVED SALE (62 ev), inventory drift
    equipment-rental  1 issue  /    7 ev - GSC API error
  Supabase advisor baseline: 3 rls_enabled_no_policy (account_analytics,
  external_post_sync_state, external_posts), 1 security_definer_view
  (subscriptions), 4 function_search_path_mutable.

  NO ALWAYS-ON MONITORING EXISTS. Claude Code cron is session-only and dies with
  the session. For real 24/7 alerting, wire sentry-watch.mjs into GitHub Actions
  on a cron - it is API-only with no local file access, so it passes the
  ralph-github gate in CLAUDE.md.

## THE BUILD PLAN - where it actually stands

  FANOUT-BUILD-PLAN-2026-09-22.md is STALE IN YOUR FAVOUR. Verified against code:
    P1-10 Clerk pk_test_ "blocks all deploys" - RESOLVED, prod is pk_live_/sk_live_
    P1-5  POST /api/v1/profiles - DONE, the route exists
    P1-8  mostly DONE - LinkedIn posts as organization, Twitter uploads media,
          reddit/threads/mastodon media done. ONLY YOUTUBE LEFT.
  Still genuinely open: P1-7 (20 placeholder credential vars - but
  src/lib/integration-status.ts:63 names the real blocker per platform, and
  REDDIT has externalBlocker null, so it needs registration only, no review
  queue), P1-9 (product_platform_accounts split-brain), P2-11 (4 missing v1
  contracts: /platforms/connect, /webhooks/[platform], /ai/generate, /ai/approve;
  /post still returns only {queued}), P2-13 (17 dashboard dirs, scope undecided).

  CX 6 ENHANCEMENTS, none built except the first: restrict credential admin
  (DONE - it became fix 1), request idempotency, platform-aware preflight
  validation, signed and retriable webhooks, SSRF guard on outbound destinations,
  atomic rate-limit admission (the CX probe admitted 20 concurrent requests with
  1 slot remaining).

## THE REAL LAUNCH BLOCKER

  ORG-CREATION P0 IS UNVERIFIED. Nobody has watched a genuinely NEW user sign up.
  Needs a human doing a real signup - no credentials, no code. It is the highest
  value thing Brad can do, and it interacts with the dead Resend: a new user may
  sign up fine and still hear nothing, because no transactional email sends.

  P0-4 (live Facebook post to OPP) is still blocked on John accepting the Meta
  Tester invite on app 772426605937002. Not a code problem.

Notion: CC COMPLETE 3e4663704e4081c1806dc470c7fd0c4d
CLAW_GATE_2_STATUS: PENDING - CFC is the sole VERIFIED_DONE authority.
