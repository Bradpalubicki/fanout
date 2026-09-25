cd C:\Users\bradp\dev\fanout

Fanout needs NO code work to resume. Read DECIDE FIRST — every open item is
blocked on Brad, on John, or on a browser session. Nothing here is a coding task.

## DECIDE FIRST — blocked on Brad, not on code

1. LOCKELUM SOCIAL ACCOUNTS — highest value, fully unblocked, ~1 hour.
   Fanout has working app credentials for Meta + Bluesky. LockeLum has no
   accounts to post TO. These three can publish through Fanout the moment they
   exist:
     - Bluesky    lockelum.bsky.social — free, no review, publishing PROVEN
     - Instagram  MUST be Business or Creator, linked to the LockeLum FB Page.
                  A personal IG account will NOT connect, regardless of creds.
     - Threads    created FROM the Instagram account — do Instagram first
   Open them on sales@lockelum.store (verified M365 shared mailbox).
   NEVER orders@lockelum.store — no mailbox, mail bounces, verification dies.
   Brand is LockeLum (capital L, capital middle L). No personal name / cell /
   address / personal email on any public profile.
   Check before creating duplicates: does a LockeLum Facebook Page already
   exist, and is the connected FB account LockeLum or NuStack?

2. ORG-CREATION P0 — THE REAL LAUNCH BLOCKER. Needs a human, no code.
   Nobody has watched a genuinely NEW user sign up. It also interacts with the
   dead Resend (item 4): a new user may sign up fine and still hear nothing,
   because no transactional email sends.
   FALSIFIED HYPOTHESIS, do not repeat it: CC claimed no org-creation path
   existed because createOrganization appears nowhere in src/. WRONG — CX found
   src/app/dashboard/page.tsx:42-56 renders Clerk OrganizationList
   (hidePersonal, afterCreateOrganizationUrl=/dashboard) whenever orgId is null.
   Org creation is USER-DRIVEN through that component; grepping for the API call
   misses it. Clerk settings (auto-create OFF, user-created orgs ON, membership
   required) are COHERENT with this design, not a misconfiguration.
   STILL UNPROVEN and now the whole test: does an org created through that
   picker ACTIVATE in the session? Failure mode to hunt — creation succeeds, the
   active org does not update, the user bounces back to the picker in a loop.
   Read window.Clerk.organization and Clerk.session.lastActiveOrganizationId in
   the page right after creating.
   Brad does the signup himself in a NEW CHROME PROFILE — not incognito (CFC
   cannot see incognito), and do not sign out of his main session. A + alias
   like brad+fanouttest1@<domain> is a separate Clerk identity whose mail lands
   in his normal inbox. CFC enters no credentials (locked rule).

3. SIX PLATFORMS BLOCKED ON JOHN — credentials are literally "placeholder".
   AUDITED 2026-09-24 by pulling production env and checking VALUES, not
   presence. The vars EXIST but hold the string "placeholder", so they look set
   in `vercel env ls`. Do NOT re-audit by listing var names — that is exactly
   what made CC wrongly report these as done mid-session.
     reddit, twitter, linkedin, youtube, pinterest, tiktok
   Each needs a developer app registration -> client id + secret.
   REDDIT has externalBlocker null in integration-status.ts — registration only,
   no review queue, so it is the fastest of the six.
   Long poles: TikTok app review, LinkedIn w_member_social review.
   Twitter/X API is PAID at every useful tier — Brad must approve spend in one
   message with amount + vendor + "confirm spend". Do not sign up.
   integration-status.ts already treats "placeholder" as absent, so the app
   reports these correctly. Nothing to fix in code.

4. RESEND — blocked on spend. fanout.digital is NOT in Resend and
   RESEND_API_KEY is the literal string "placeholder", so all 7 send sites fail
   SILENTLY (noreply@ x5, onboarding@ x2). Creating the domain returns 403
   "You have reached the domain limit of your plan." Deleting veteransthrive.org
   freed a slot (20->19) and it STILL 403s, so the real cap is below 19 and the
   existing domains are grandfathered. Needs, in ONE message: exact amount,
   vendor (Resend), and the words "confirm spend".
   SPF already includes amazonses.com, so post-upgrade it is ~10 min: create
   domain -> DKIM into GoDaddy (needs a gd_pat_ PAT, NOT on this machine) ->
   verify -> mint key -> vercel env add -> redeploy -> live send + read the
   delivery status back.

5. website-engine commit 00e1b20 is UNPUSHED, on purpose. STILL OPEN.
   Patches the same Clerk CVE + inngest 3.52.0 -> 3.54.2. Vercel had REFUSED to
   deploy on the vulnerable inngest: "Vulnerable version of inngest detected
   (3.52.6). Please update to version 3.54.0 or later." Verified there: npm audit
   CLERK CLEAN, criticals 4->2, highs 35->32, tsc exit 0.
   NOT pushed because website-engine is outside the repo that session worked in
   and pushing auto-deploys to production. Brad decides.
   Its CLAUDE.md + 2 untracked files belong to Brad — do not commit them.

6. YOUTUBE — needs a PRODUCT decision, not code.
   youtube.ts posts text to /youtube/v3/posts (community posts, which require
   1000+ subscribers). That is not how video reaches YouTube. Real video needs
   videos.insert plus a resumable upload. Three blockers, none fixed inside the
   distributor:
     - mediaUrls is z.array(z.string().url()) everywhere — no MIME/type
       distinction, so nothing can tell youtube.ts a URL is a video
     - resumable upload does not fit a serverless request (multi-MB, 308-resume).
       Decide WHERE it runs (Inngest? direct-from-client?) first
     - community posts and video publishing are DIFFERENT PRODUCTS. Replacing
       the community path removes a working feature.
   ASK Brad which before scoping. /scope-check then /research-build — it is a
   feature, not a fix. This is the ONLY remaining item in P1-8.

7. FLEET CLERK/NEXT SWEEP — go/no-go + which repos have live client traffic.
   See SECURITY below. 41 of 51 repos, not started, needs Brad go-ahead.

## STATE — fanout is green, fce747c live

  HEAD fce747c, SHA confirmed on remote, Vercel READY, aliased to fanout.digital.
  Tests 406 passing / 35 files. tsc clean.
  Stack: Next.js 16.3.6, Supabase, Clerk 6.39.7, Inngest, Vercel.
  Working tree clean except BIBLE-UPDATE-NEEDED.md — that file belongs to BRAD.
  Auto-generated changelog noise, not a work item. NEVER commit it.

## DONE 2026-09-24 (media + security session) — do not redo

  Media track — three distributors now send attached images instead of silently
  dropping them. Each test asserts the PROVIDER CALL carries the media, not that
  post() returned success — it returned success throughout the entire defect.
  Every assertion was proven to go RED under a mutation, with the source then
  restored byte-identical.
    6c0472a  reddit   — lease -> S3 bytes -> kind image. 4 mutants.
    d46f44a  threads  — media_type IMAGE + image_url on container. 3 mutants.
    a35c79f  mastodon — v2/media -> media_ids[] on status. 4 mutants.
    fce747c  security — next 16.2.12 -> 16.3.6, clerk/nextjs 6.39.0 -> 6.39.7

  Failure policy DIFFERS BY PLATFORM deliberately — do NOT make it consistent:
    - Reddit FAILS THE POST if upload fails. kind image vs kind self are
      different post types; a silent downgrade publishes something else entirely.
    - Mastodon and Twitter POST THE TEXT ANYWAY. A status is the same object
      with or without an attachment.
  Tests pin both directions. A mutant swapping one for the other fails.

  THREADS IMAGE UPLOAD HAS NEVER RUN LIVE. The first real Threads post is also
  the first live test of that code.

  META NEEDS NO REGISTRATION. Verified 2026-09-24: FACEBOOK / INSTAGRAM /
  THREADS App ID AND App Secret are BYTE-IDENTICAL — one already-verified Meta
  app, already publishing live to Facebook. No Business Verification needed. The
  March "Platform Status" block in .claude/CLAUDE.md is STALE and says
  otherwise; it also predates Facebook and Bluesky going live. Trust
  src/lib/integration-status.ts — it is authoritative and correctly separates
  credentials-present from external-review-gate.

## DONE EARLIER (CX audit session) — do not redo

  030472f  prompt caching on setup-agent (tools+system = 1903 tok prefix).
           Marker on the LAST TOOL, not system: tools order BEFORE system, and
           SYSTEM alone is 398 tok — under the 1024 minimum, so a marker there
           caches NOTHING. Proven live: cache_read 1189 on every repeat call.
           Skipped 10 other call sites — measured, not assumed.

  Seven defects from a CX audit, closed and CX-AGREED at 469d2b9:
  5cda6ca  1 the credential action was a PROD-CONFIG ESCALATION (any signed-in
             user could write arbitrary Vercel production env vars) -> now
             isNuStackAdmin + an allowlist derived from PLATFORMS so the two
             cannot drift
           2 cancelled scheduled posts published anyway -> DB recheck after
             sleepUntil. Reschedule emits NO new event, so it fired at the OLD
             time
           3 all 7 post_results upserts named no conflict target
           4 increment_post_attempts DID NOT EXIST -> migration 020 + error check
           5 Sentry enabled on an invalid DSN ("placeholder" is truthy)
  c4f551b  CX rejected 2 and 4 — both were CC's OWN defects: a 60s tolerance
           window published early by its own width, and sendEvent ran BEFORE the
           increment so a failing RPC emitted uncapped retries.
  a849913  closed the two residual notes
  41f9630  CX rejected both residuals again, also correctly. The helper handled
           a RETURNED error but not a REJECTED promise; the DSN check was
           protocol-only AND validated a trimmed copy of an untrimmed value.
  469d2b9  THE ONE WORTH READING: all three sentry configs had SHIPPED a regex
           with the backslash MISSING from the digit class — which INVERTS the
           check (valid "456" false, invalid "d" true). Eight green tests never
           noticed, because each test re-declared the validator BY HAND and the
           copy was correct. A mirror only tests itself. Tests now EXTRACT
           isUsableDsn from each real config file and evaluate it.
  d31acbf  migration 021 — decrypt_token/encrypt_token were granted to anon,
           i.e. callable UNAUTHENTICATED at /rest/v1/rpc/decrypt_token. Also
           corrects 020: its REVOKE ... FROM PUBLIC left authenticated=X
           standing, because revoking PUBLIC does not drop an explicit role
           grant. All three verified anon=f authenticated=f service_role=t.

## SECURITY — fanout patched, FLEET IS NOT

  fce747c closed two UNAUTHENTICATED Next.js RCEs (everything <= 16.3.2:
  GHSA-p293-qw3h-jr36 windows-hosted, GHSA-2xp9-vwfh-vxw4 image optimization via
  AVIF) and the Clerk CRITICAL middleware route-protection bypass. The tilde pin
  ~16.2.0 could never reach the fix, so the range is now ~16.3.0.

  Audited C:/Users/bradp/dev on 2026-09-24 against the npm advisory DB:
  41 of 51 repos with Clerk installed carry the CRITICAL bypass. The 10 clean:
  accounting-engine, audit-engine, equipme-canary, equipme-rentals-deploy,
  fanout, marketplace-pickup, mh-auction, rv-rental-os, sendpaid, website-engine.
  (An earlier carryover said 9 repos and listed accounting-engine as exposed at
  6.39.5 — it is above 6.39.2 and therefore clean. The real figure is 41.)

  Safe targets CONFIRMED against the advisory DB: 6.39.7 in the 6.x line, or
  7.3.7+ in the 7.x line. 6.x repos take a PATCH bump inside v6, not a major.
  Real advisory ranges — do NOT infer these, CC got them wrong twice before
  querying the source:
    CRIT middleware bypass: 6.x <6.39.2 ; 7.0.0-7.2.0
    HIGH org-authz bypass : 6.0.0-6.39.2 ; 7.0.0-7.2.3
  The org-authz one matters most here: every gated route keys on orgId, so an
  org-check bypass is a tenancy bypass.
  Most repos are also still on next ~16.2.0, inside the RCE range.
  Per repo: npm install next@"~16.3.0" @clerk/nextjs@"^6.39.7" --save
            --legacy-peer-deps ; then npx tsc --noEmit && npm test ; commit,
            push, verify Vercel READY.
  NOT STARTED — 41 live client-facing deploys needs Brad go-ahead and a
  live-traffic priority order. Batch ~5 at a time, verifying each deploy.

## HOW TO VERIFY — this repo has been burned by every one of these

1. Mutation-check every test. Break the thing, confirm RED, restore, diff
   byte-identical. And test the ARTIFACT, never a hand-copy of it — see 469d2b9.
2. A credential being PRESENT is not a credential being REAL. Pull the value.
   Six platforms here hold the literal string "placeholder" and look set in
   `vercel env ls`.
3. Do not infer an advisory version range. Query the npm advisory DB.
4. pgrep DOES NOT EXIST in Git Bash. An "until ! pgrep -f X" loop exits
   instantly and makes a running job look finished. Wait on the artifact:
   until grep -q "tokens used" out.txt; do sleep 20; done
5. Heredocs eat backslashes — that is how the inverted regex shipped. Build them
   with String.fromCharCode(92) and read the bytes back off disk. A single
   apostrophe inside a heredoc also breaks the outer quoting: write long files
   with the Write tool, not inline. Three attempts were lost to this on
   2026-09-24.
6. Never parse Vercel CLI output — use mcp__claude_ai_Vercel__get_deployment and
   read state + meta.githubCommitSha. Also "cmd | tail" reports the exit code of
   TAIL, not of the command.
7. After every push, confirm the SHA landed: git ls-remote origin main | grep
   $(git rev-parse HEAD)
8. This repo is CRLF. Normalize before splicing, write back as CRLF.
9. The commit-message hook rejects the -m "$(cat ...)" form. Use git commit -F -.
10. VERCEL_TOKEN is unset in the Bash shell. `vercel env ls` and `vercel env
    pull` work; the brad-brain vercel MCP returns "VERCEL_TOKEN not set". If you
    pull env to a file, DELETE IT when done.
11. READ THIS FILE BEFORE OVERWRITING IT. On 2026-09-24 CC nearly destroyed a
    prior session's carryover — including the unpushed website-engine commit in
    item 5 — by writing a fresh one over the top. Merge, never replace.

## ERROR SWEEP — what is actually broken out there

  Tool written and working:
  node /c/Users/bradp/dev/fleet-status/scripts/sentry-watch.mjs
  (needs SENTRY_AUTH_TOKEN in env; silence means clean). README sits beside it.

  FANOUT IS BLIND: there is NO fanout project among the 22 in Sentry, and the
  DSN is "PLACEHOLDER". No Sentry errors for fanout means nothing is being
  reported, not that nothing is wrong. Worth creating.

  Known baseline (do NOT re-report these as new):
    agency-engine     2 issues / 9860 ev — N+1 on /api/cron/deploy-health-monitor
    courtcase-search 36 issues / 1649 ev — incl. REAL bugs: column
                       case_notifications.viewed_at does not exist, and
                       FeatureTier has no attribute BASIC
    flipiq           22 issues /  199 ev — UNRESERVED SALE (62 ev), inventory
                       drift
    equipment-rental  1 issue  /    7 ev — GSC API error
  Supabase advisor baseline: 3 rls_enabled_no_policy (account_analytics,
  external_post_sync_state, external_posts), 1 security_definer_view
  (subscriptions), 4 function_search_path_mutable.

  NO ALWAYS-ON MONITORING EXISTS. Claude Code cron is session-only and dies with
  the session. For real 24/7 alerting, wire sentry-watch.mjs into GitHub Actions
  on a cron — it is API-only with no local file access, so it passes the
  ralph-github gate in CLAUDE.md.

## THE BUILD PLAN — where it actually stands

  FANOUT-BUILD-PLAN-2026-09-22.md is STALE IN YOUR FAVOUR. Verified against code:
    P1-10 Clerk pk_test_ "blocks all deploys" — RESOLVED, prod is pk_live_/sk_live_
    P1-5  POST /api/v1/profiles — DONE, the route exists
    P1-8  mostly DONE — LinkedIn posts as organization, Twitter uploads media,
          reddit/threads/mastodon media done 2026-09-24. ONLY YOUTUBE LEFT.
  Still genuinely open: P1-7 (placeholder credential vars — see DECIDE item 3),
  P1-9 (product_platform_accounts split-brain), P2-11 (4 missing v1 contracts:
  /platforms/connect, /webhooks/[platform], /ai/generate, /ai/approve; /post
  still returns only {queued}), P2-13 (17 dashboard dirs, scope undecided).

  CX 6 ENHANCEMENTS, none built except the first: restrict credential admin
  (DONE — it became fix 1), request idempotency, platform-aware preflight
  validation, signed and retriable webhooks, SSRF guard on outbound
  destinations, atomic rate-limit admission (the CX probe admitted 20 concurrent
  requests with 1 slot remaining).

## OPEN, NOT STARTED

  DASHBOARD ISOLATION — tests/helpers/predicate-db.ts covers v1, but
  /api/dashboard uses Clerk ORG auth instead of API keys, so the harness does
  not reach it. Two dashboard defects were already found by inspection (biolink
  PATCH mass assignment, generate-content proxy) = weak evidence more exist.
  WARNING: the v1 probes authenticate by API key; these need a Clerk session +
  org context, so this may be a rewrite rather than an extension. If it is, stop
  and say so rather than quietly building a second harness.

  IMAGE GENERATION + AI CONTENT ENHANCEMENT — Brad asked for both, neither
  started. Scope before building; not small.

## DO NOT DO THESE

- Do not re-audit the six security fixes or the eight isolation probes. Closed,
  live, mutation-verified. Listed at the bottom.
- Do not redo the reddit/threads/mastodon media work. SHAs above.
- Do not re-register Meta anything. Same app as Facebook, already verified.
- Do not re-audit platform credentials by listing env var NAMES. Check values.
- Do not write an A/B/C probe for v1/profiles. Admin provisioning route, orgId
  comes from the body BY DESIGN, 12 existing tests cover the real gate.
- Do not chase npm run build failing locally. No .env.local here; it dies on a
  missing Clerk key at prerender. Vercel builds fine.
- Do not re-investigate CRON_SECRET. Set in all three environments, verified.
- Do not commit BIBLE-UPDATE-NEEDED.md. It is Brad's.

## NEEDS BRAD / NEEDS JOHN — cannot be closed by code

- Brad: LockeLum accounts (1), signup test (2), Resend spend (4), website-engine
  push (5), YouTube product call (6), fleet sweep go/no-go (7), Twitter/X spend.
- John: six developer app registrations (3).
- John: P0-4 (live Facebook post to OPP) is blocked on John accepting the Meta
  Tester invite on app 772426605937002. Not a code problem.
- John: john@fanout.digital still forwards to a personal Gmail. Repoint to the
  NuStack mailbox — that external hop is what made Gmail reject forwarded mail.
- John: frontend redesign — the only evidence is an 8.5s phone video of a
  monitor. NOT ACTIONABLE. Need the HTML, a URL, a Figma file, or full-page
  screenshots at desktop + mobile widths.

## REFERENCE — closed tracks

Media by distributor:
  twitter cf9621f DONE (no test) | reddit 6c0472a | threads d46f44a |
  mastodon a35c79f — last three mutation-verified | youtube OPEN (DECIDE item 6)
Already handled media before this track: bluesky, facebook, instagram,
pinterest, tiktok, google-business-profile.

Security track, all fixed + live + mutation-verified:
  11a57ed  fan-out (post,profile,platform) tuple bound before token selection
  de8b0bd  DM replies refused on all 5 public transports (allowlist)
  095acad  cron auth fails closed — 5 cron routes + generate-social-content
  3be5875  Meta Page access tokens no longer returned to the browser
  a523777  biolink PATCH allowlist (was mass assignment via rest spread)
  de7ab32  generate-content proxy vets body before lending INTERNAL_API_KEY

Isolation track, 8 of 9 v1 routes proven by A/B/C probe:
  2592e63 predicate-db.ts + v1/history | ab62b30 v1/analytics/account
  49c911f v1/analytics/[postId] | af88ca7 v1/platforms+status+disconnect
  c55b360 v1/post + v1/schedule (write boundary)

Extending the harness? Two traps, both hit for real:
  - Seed rows need org_id, or an org-scoped filter matches NOTHING and the leak
    reads as a pass.
  - Do not confound the discriminator with tenancy. Every principal must share
    platform/date values, or a handler filtering by platform excludes siblings
    coincidentally and looks correctly scoped.

Notion: CC COMPLETE 3e4663704e4081c1806dc470c7fd0c4d
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
