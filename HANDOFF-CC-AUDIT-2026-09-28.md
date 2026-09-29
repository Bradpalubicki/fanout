cd C:\Users\bradp\dev\fanout

# HANDOFF — CC AUDIT PACKAGE — 2026-09-28  (v2, REVISED)

v1 (md5 493eef61baa4d0a8d1249f6e7a3d99b7) was reviewed by CX and returned
CHANGES REQUIRED. This v2 applies every CX correction, plus two errors CC found
in its own v1. Zero code changes in either version.

## CHECKPOINT

    repo    C:/Users/bradp/dev/fanout
    branch  main
    commit  c04ff6cb77919b7190b70c1d200edd474c1705db
    remote  CONFIRMED on origin/main
    tree    src/ tests/ supabase/ byte-identical to c04ff6c
    Vercel  previously reported READY + aliased fanout.digital (2026-09-24);
            NOT independently reverified in this audit

UNCOMMITTED, PRESERVE, DO NOT COMMIT: `BIBLE-UPDATE-NEEDED.md` — Brad's file.

## A. END GOAL — AUTHORITATIVE, QUOTED NOT PARAPHRASED

Source: `BUILD.md`, reconciled CC+CX 2026-09-22 in
`FANOUT-BUILD-PLAN-2026-09-22.md`. **CC's v1 paraphrase ("a post composed once
reaches every connected platform, with media, at the intended time") was CC's own
invention and is materially wrong — it omits the revenue roles entirely.**

> Self-hosted Ayrshare replacement. ONE API call posts to 9+ platforms.
> Multi-tenant via Clerk orgs. Roles in spec priority:
>  1. INTERNAL INFRA — every NuStack engine calls /api/v1/post instead of paying
>     Ayrshare ($2,995/mo @5 engines)
>  2. AGENCY ENGINE BACKEND — provision profile+API key per client
>     (POST /api/v1/profiles)
>  3. STANDALONE SaaS — $199-499/mo, ICP agencies with 5-50 client accounts
>  4. NuStack product marketing (CertusAudit, PocketPals) via
>     product_platform_accounts

DEFINITION OF DONE (CX correction, accepted and BINDING):

> "done" is NOT one successful post. Spec also requires tenant isolation, token
> lifecycle, scheduling/retries, media, analytics, webhooks, AI gen/approval,
> agency provisioning, dashboard. One post = first integration milestone, not
> completion. (BUILD.md:32,187,1009)

CONSEQUENCE FOR SEQUENCING: every session since 09-22, CC's included, ranked work
by defect severity in the DISTRIBUTOR layer — role 4 territory. The roles that pay
for the project are 1-3. P2-11's four missing contracts are NAMED IN THE DoD and
were wrongly filed by CC as "scope undecided".

## B. CURRENT STATE — verified against code this session

Build-plan items CLOSED (code checked, not assumed):

    P0-1  /api/v1 trapped in Clerk matcher — "outranks every other issue"
          FIXED. proxy.ts:3 deliberately excludes /api/v1 and /api/cron.
    P0-2  OAuth authorize had ZERO org ownership check
          FIXED. 3 org_id refs in src/app/api/oauth/[platform]/authorize/route.ts
    P0-3  retry cron emitted social/post.retry with no consumer; missing-token
          path returned before writing post_results
          FIXED. retry-post.ts:18 consumes it; fan-out.ts surfaces failed writes.
    P1-5  POST /api/v1/profiles — EXISTS
    P1-10 Clerk pk_test_ — FIXED, prod is pk_live_/sk_live_

Still open against the DoD:

    P2-11 MISSING, all four: /api/v1/platforms/connect, /api/v1/webhooks/[platform],
          /api/v1/ai/generate, /api/v1/ai/approve. Plus /post returns only
          {queued} where the spec promises platform results (BUILD.md:400).
          These are DoD items, NOT optional polish.
    P1-9  product_platform_accounts split-brain
    P2-13 dashboard scope

### ROLE 1 HAS LIVE CONSUMERS — CC v1 IMPLIED OTHERWISE AND WAS WRONG

CC ran ONE narrow grep (`fanout.digital/api/v1`), got zero hits, and was about to
report role 1 as aspirational. FALSE NEGATIVE from too narrow a pattern.

Scoped search of every `*/src` in C:/Users/bradp/dev found FOUR engines with real
integration routes — actual `fetch` with a server-side `FANOUT_ENGINE_KEY`, not stubs:

    littleroots-studio/src/app/api/fanout/post/route.ts
    wellness-engine/src/app/api/fanout/post/route.ts
    stylist-engine/src/app/api/fanout/post/route.ts
    rpm-engine/src/app/api/fanout/post/route.ts   (+ rpm-engine-pc-merge)

Also referencing fanout: marketing-leads-engine, content-engine.

**ENDPOINT DIVERGENCE — REQUIREMENTS RECONCILIATION ITEM FOR CX.**
All four call `${FANOUT_API_URL}/api/engine/submit` (route.ts:52).
The plan specifies role 1 as "every NuStack engine calls **/api/v1/post**".
BOTH endpoints exist in fanout (`src/app/api/engine/`, `src/app/api/v1/post/`).

Either /api/engine/submit is a legitimate second contract that belongs in the
plan, or four live engines are on a path that bypasses the spec'd machine API.
CC is NOT guessing which. What CC can state: the isolation work covered the v1
surface (8 of 9 v1 routes have A/B/C tenancy probes) and there is NO EVIDENCE
anyone probed /api/engine/submit the same way. If four live engines post through
it, that is the higher-traffic surface with the weaker verification.

## C. FINDINGS — 6 total. CX corrections applied.

### P1-A  Reschedule: no replacement event; delivery falls to cron  (CX #5, CORRECTED)

**CC v1 said "PERMANENTLY STRANDS / never publishes at all". THAT WAS OVERSTATED
AND IS WITHDRAWN.** CX found the recovery chain CC failed to trace; CC verified it:

    vercel.json:3            */5 * * * *  ->  /api/cron/process-queue
    process-queue/route.ts   status='pending' AND scheduled_for <= now
                             -> emits 'social/post.created'
    fan-out-post.ts:42       consumes it -> fanOut()

So a rescheduled post IS recovered by cron. CX withdrew its own unconditional
stranding conclusion too.

DEFENSIBLE FINDING: the original scheduled worker skips
(scheduled-post.ts:54), the reschedule endpoint emits NO replacement event
(grep sendEvent|inngest in that route: empty, exit 1), and delivery depends on the
separate cron path. **Production cron operation and the resulting delivery delay
remain UNPROVEN.**

### P1-A2  CANCELLED POSTS CAN PUBLISH VIA THE CRON PATH  (CX omission — CC MISSED THIS)

Worse than what CC reported. `fan-out.ts` fetches the post, checks tenant
isolation (:158), then writes `status:'posting'` (:175) — with **NO check that the
post is still `pending`**. A replayed or stale `social/post.created` event
publishes a cancelled post.

CX probe (mocked provider calls, not live publications):

    due pending recovery:                        provider calls=1
    replayed created event after cancellation:   provider calls=2
    stale created event after future reschedule:  provider calls=3

The 09-24 fix guarded scheduled-post.ts and left the cron path open. PKG-1 MUST
cover this path.

### P1-B  Mastodon publishes attachments before processing completes  (CX #1, scoped)

`mastodon.ts:49` — `res.ok` is true for HTTP 202; the attachment id returns
immediately; ~:99 submits the status. The source comment at mastodon.ts:14 asserts
"the instance holds the status until processing finishes" — an UNVERIFIED FACTUAL
CLAIM ABOUT A THIRD PARTY. Mastodon documents 202 as pending with readiness
polling via GET /api/v1/media/:id (206 also pending).
CX probe: upload 202 -> publish 422 -> post() success:false.

CX SCOPING CORRECTION APPLIED: the consequence is **conditional — when publication
encounters an attachment still processing**, not "every large image".
Why tests miss it: mastodon-media.test.ts:47 unconditionally succeeds every status request.

### P2-C  Sentry guard accepts DSNs the installed SDK rejects  (CX #2, confirmed)

    guard=true  sdk=ok(accepted)          https://abc123@o1.ingest.sentry.io/456
    guard=true  sdk=UNDEFINED(rejected)   https://bad-key@o1.ingest.sentry.io/456
    guard=true  sdk=UNDEFINED(rejected)   https://abc123@o1.ingest.sentry.io/456/

CC ERROR RECORDED: CC first scored makeDsn on throw/no-throw and wrongly reported
CX incorrect. makeDsn signals rejection by RETURNING UNDEFINED. CX's table was right.

### P2-D  Zero-byte uploads survive both media tests  (CX #3)

reddit-media.test.ts:104 and mastodon-media.test.ts:90 assert only
`toBeInstanceOf(Blob)`. CX replaced `new Uint8Array(bytes)` with
`new Uint8Array(0)` and all 10 tests passed. Coverage defect; NOT evidence that
production uploads empty files.

### P2-E  Twitter post() has no test  (CX #4)

CX inserted an immediate failure return into the real Twitter `post()`; ALL 406
TESTS PASSED. Only tests/lib/list-posts.test.ts:129 touches Twitter, exercising
listPosts. Precise claim: the tested suite failed to detect a disabled post().

### P2-F  Stale Meta blocker pinned green by a test  (CC's finding, SCOPE WIDENED BY CX)

`src/lib/integration-status.ts:66-68` sets
`externalBlocker:'Meta Business Verification'` on facebook/instagram/threads, and
`tests/lib/integration-status.test.ts:123` ASSERTS that stale string — so a correct
fix turns the suite RED and reads as a regression.

CC v1 said "3 files". CX found four more carrying equivalent claims:

    src/components/dashboard/platform-connect-wizard.tsx:262
    src/app/dashboard/social/setup/setup-wizard-client.tsx:590
    src/app/actions/send-setup-email.ts:59
    src/lib/oauth-registration/automation-support.ts:108

**CX REJECTS CC'S BROADER LEAP, AND CC ACCEPTS:** Facebook publishing live is NOT
sufficient evidence that Instagram and Threads have no applicable permission or
review blockers. They are distinct permission surfaces. This directly affects the
LockeLum Instagram/Threads work — do not treat those as pre-cleared.

## D. MAINTAINED CLAIMS — CLOSE NARROWLY ONLY (CX scoping, accepted)

CC v1's blanket "do not re-audit" was TOO BROAD.

| Claim | What may be closed | What may NOT |
|---|---|---|
| Media reaches the provider call | mocked payload wiring at this checkpoint | byte integrity, readiness, live delivery |
| Sentry tests extract real validators | extraction provenance | validator correctness. Harness executes an extracted fn without imported deps — revisit in PKG-3 |
| Migration 021 revokes/grants stated roles | the SQL TEXT | deployed enforcement |

CORRECTION to CC v1: migration 020 revoked **PUBLIC and anon** (020:27) and
concerned `increment_post_attempts`. CC wrote "020's PUBLIC-only revoke" — wrong.

## E. STATUS DISTINCTIONS — CX wording corrections applied

    IMPLEMENTED / SOURCE-REVIEWED   migration SQL text (NOT execution-tested)
    IMPLEMENTED + TESTED LOCALLY    reddit/threads/mastodon media payload wiring;
                                    sentry extraction harness
    VERIFIED END TO END             Facebook publishing — historical report,
                                    pre-2026-09-24, not reverified here
    NOT VERIFIED END TO END         Threads image publication.
                                    CC v1 said "HAS NEVER RUN LIVE / first real post
                                    is its first execution" — UNPROVEN and literally
                                    incorrect; the path executes in mocked tests
                                    (threads-media.test.ts:46). Correct wording:
                                    "No independently verified live image-publication
                                    evidence supplied."
    DEPLOYED                        c04ff6c; Vercel READY reported 2026-09-24,
                                    NOT reverified in this audit
    ACLs decrypt_token/encrypt_token
                                    "Previously reported applied and verified in
                                    d31acbf; current deployed effective permissions
                                    not independently reverified in this audit."
                                    (CC v1 said "READ, not executed against the live
                                    DB" with no session qualifier — misleading;
                                    021:15 records an after-application matrix.)
                                    decrypt-token.test.ts:3 mocks RPC and cannot
                                    supply this verification.

## F. VERIFICATION LIMITS

- No live external posting. No credential entered. CFC NOT used this session.
- 406/406 tests green, 35 files; tsc exit 0.
- CX's earlier parallel-run Reddit failures: today's focused suite passed both
  serially and in parallel, which does NOT identify the cause. Shared-fetch-mock
  remains a HYPOTHESIS. Diagnose in PKG-8 BEFORE accepting PKG-4's test evidence.
- The 41-repo fleet count is CC's measurement from INSTALLED @clerk/nextjs
  versions across 51 repos on 2026-09-25 against real advisory ranges — not
  inference. CX marked it "UNPROVEN here" because CX lacked that evidence; CC
  supplies it into PKG-7 rather than re-litigating.
- Production credentials checked BY VALUE 2026-09-25: RESEND_API_KEY,
  REDDIT/TWITTER/LINKEDIN/YOUTUBE_CLIENT_ID, NEXT_PUBLIC_SENTRY_DSN all hold the
  literal string "placeholder"; PINTEREST/TIKTOK/BLUESKY/INSTAGRAM/THREADS absent.
  Pulled env file deleted after reading.
- Fanout has NO Sentry project among the 22. Absence of errors is not health.

## G. CC'S OWN METHOD GAPS

CC's gap analysis found 1 of 6 findings; CX found both P1s and corrected 6 things.
Pattern: CC verified claims were IMPLEMENTED; CX verified whether they were TRUE.

1. CC mutated by DELETING features (all caught). CX mutated by DEGRADING them —
   Uint8Array(0), a stub post() — and those SURVIVED 406 green. A delete-only
   suite cannot see "runs but does the wrong thing".
2. CC asserted PERMANENT data loss without tracing the second delivery path.
   Trace every path that can deliver, not just the changed one.
3. CC read migration SQL and treated reading as verification.
4. CC mis-scored an SDK API (throw vs undefined) and contradicted a correct finding.
5. CC ran ONE narrow grep for role-1 consumers, got zero, and nearly reported a
   false negative. A negative from one pattern is weak evidence.
6. CC carried a self-invented end goal for an entire session without reading
   BUILD.md.

## H. PACKAGE ORDER — re-ranked by END-GOAL PROGRESS (CX + CC agree)

CC v1 ranked by defect severity and put PKG-7 below four P2s. CX:
"ranking reported critical auth exposure across live client deployments below four
P2 findings is wrong; 'not degrading further within a session' is not evidence
that exposure can safely wait." CC CONCEDES.

    PKG-7  FLEET SECURITY TRIAGE — FIRST. 41 repos, CRITICAL Clerk middleware
           bypass + HIGH org-authz bypass (a TENANCY bypass: every gated route
           keys on orgId) + next ~16.2.0 inside two unauthenticated RCE ranges.
           Triage = deployed versions, applicable advisories, exposed apps,
           containment, rollout order. READ-ONLY; not deploy authorization.
           BLOCKED ON BRAD: which repos carry live client traffic.
    PKG-6  DEPLOYED ACL VERIFICATION — early, alongside PKG-7. No dependency on
           the P2 work; resolves a security uncertainty. Prove anon/authenticated
           DENIED and service_role ALLOWED on the deployed DB.
    PKG-0  RECONCILE /api/engine/submit vs /api/v1/post — CX's call. Decides
           whether role 1 is complete or bypassing spec, and whether the
           higher-traffic surface needs the isolation probes v1 has.
    PKG-1  Reschedule + dispatch, INCLUDING the cancelled/stale cron path (P1-A2)
    PKG-2  Mastodon readiness polling
    PKG-4' P2-11 DoD CONTRACTS — promoted out of "scope undecided": the four
           missing v1 routes + the {queued} vs platform-results reconciliation
    PKG-3  Sentry via makeDsn (must update the extraction harness; current
           source-shape assertions at sentry-placeholder.test.ts:30 would obstruct it)
    PKG-4  Upload byte equality + Twitter post() coverage
    PKG-5  Meta blocker — now SEVEN files + test + .claude/CLAUDE.md
    PKG-8  Diagnose the parallel-run Reddit failures BEFORE accepting PKG-4 evidence

Dependencies: PKG-1 and PKG-2 independent of each other. PKG-2 and PKG-4 share
Mastodon tests — need an agreed test baseline. PKG-3 must change its harness.

## I. AGREED ACCEPTANCE SPECS — PKG-1 and PKG-2 (CX-authored, CC challenged)

PROPOSED acceptance requirements for joint approval. NOT approved implementation
instructions. CC has reviewed both and accepts them as written.

**PKG-1 — rescheduling and dispatch**
Acceptance:
- Through the actual API and BOTH delivery paths, move pending post P from T0 to
  T1, earlier and later, including one-second changes.
- Healthy deps + controlled clock: ZERO provider calls before T1; exactly one
  successful publication per selected platform when T1 becomes due.
- Repeated reschedules, duplicate events, cron/worker overlap, and rescheduling
  back to a previous timestamp deliver only the latest accepted schedule.
- Cancellation completed before dispatch claims the post prevents publication via
  EITHER event path. A reschedule/cancel racing an already-claimed delivery
  returns an explicit conflict, not a false acknowledgement.
- A successful reschedule response requires durable delivery responsibility.
  Queue failure or process interruption leaves recoverable work or returns
  failure — no silent success followed by abandonment.
- Preserve tenant authorization and existing cancellation behaviour. Verify
  PROVIDER-CALL COUNTS and stored outcomes, not merely event emission.
- Ambiguous provider outcomes defined explicitly: a lost response must not cause
  blind duplicate publication or a false success claim.
Rejection: any early, stale, cancelled, duplicate or missing publication under
these controls; success without durable recovery; or tests that pass when
replacement delivery is disabled. scheduled-post-cancel.test.ts:65's skip-only
assertion is insufficient.

**PKG-2 — Mastodon readiness**
Acceptance:
- A synchronous ready upload publishes once with its attachment id.
- 202 + pending polls => ZERO status requests until readiness; then ONE status
  request carrying the ready ids.
- Bounded policy: 60s readiness deadline after upload acceptance, nominal 2s
  polling, each request bounded by remaining time; rate-limit delays cannot
  extend the deadline.
- Processing failure, malformed readiness responses or deadline expiry EXCLUDE
  that attachment. Publish once with remaining ready attachments; if none remain,
  publish text once, preserving the recorded fallback policy (mastodon.ts:89).
- Test mixed ready/failed/pending, the 4-attachment limit, unchanged text, text-only.
- A failed status publication must not return success. An ambiguous status
  response must not initiate an uncontrolled second text post.
Rejection: any status referencing pending media; polling past the deadline; failed
media preventing the prescribed text fallback; a ready attachment disappearing;
duplicate status publication; or a readiness-skipping mutant staying green.

## J. PRESERVED DECISIONS — do not "fix" these

- Per-platform failure policy is DELIBERATELY INCONSISTENT. Reddit FAILS the post
  when upload fails (kind image vs kind self are different post types). Mastodon
  and Twitter POST THE TEXT ANYWAY. Do not make it consistent.
  NOTE: P1-B currently VIOLATES this for mastodon.
- Meta needs no NEW app registration — one verified app, shared credentials,
  already publishing to Facebook. This does NOT clear Instagram/Threads
  permissions (see P2-F).
- integration-status.ts treating "placeholder" as absent is CORRECT.
- v1/profiles takes orgId from the body BY DESIGN (admin provisioning route).
- approvals IS spec'd (BUILD.md:594,1020) — not dashboard creep.
- Do not commit BIBLE-UPDATE-NEEDED.md.
- CC sets CLAIMED_DONE only. CFC is sole VERIFIED_DONE authority.

## K. PROCESS — objection RESOLVED between agents, no Brad adjudication needed

CC objected that CX is named both plan author and acceptance reviewer, conflicting
with "neither agent may independently approve its own work". Evidence offered:
P1-A as a plan-level defect.

CX accepted the substantive safeguard, rejected the categorical role conflict:
independence attaches to the ARTIFACT — CC challenges CX's exact plan against the
END GOAL; CX reviews CC's exact implementation against the spec AND the end goal;
neither supplies its own approval; a discovered SPEC defect reopens the PLAN gate
even if implementation conforms perfectly.

CX also refused CC's premise that the 09-24 change "met its spec exactly" — no
versioned spec comparison was produced — and CC's stranding premise needed the
cron correction.

**CC WITHDRAWS the structural objection and ACCEPTS CX's artifact-independence
formulation.** CC's strongest example was weakened by its own error. The
protection CC wanted is delivered by the "spec defect reopens the plan gate" clause.

## N0. JOINT APPROVAL RECORDED — CX APPROVE + CC CONCUR at c2ac230

THE RECIPROCAL GATE CLOSED. Both agents approved the SAME checkpoint:
c2ac230d9cd1b39625f3ae5761d99b84d14a6cdf. Pushed; SHA confirmed on origin/main.

    07d3bfa  byte equality           CX APPROVE (retained)
    8256525  twitter post() coverage  CX APPROVE with c2ac230 corrections
    e1a0be7  sentry delegation        CX APPROVE with c2ac230 corrections
    ebc006b  direct dependency        CX APPROVE
    c2ac230  remediation              CX APPROVE

CX approves the CORRECTED CHECKPOINT, explicitly NOT the defective intermediate
commits independently. All 10 requested mutants KILLED. Production-defines table
identical across client/server/edge with debug present and removed — no guard row
differs. CC reproduced independently: src/ identical to c04ff6c (exit 0), digit
class byte-verified as 92,100 in all three configs, no 32-hex claim remaining,
valid DSN still ENABLES and placeholder still rejected in all three, 418/418, tsc 0.

THE DEFECT CX CAUGHT IN e1a0be7 — worth reading, it inverts an intuition:
  @sentry/core's validateDsn() opens with `if (!DEBUG_BUILD) return true`, and
  next.config.ts:46 sets disableLogger:true, which strips debug from production.
  CX executed the real webpack callbacks: client, server AND edge all emit
  __SENTRY_DEBUG__: false. So delegating to makeDsn was STRICTER IN DEV and
  LOOSER IN THE BUILD THAT SHIPS — it accepted ftp://, a non-numeric project id,
  and a trailing-slash path, all of which the discarded hand-rolled guard
  rejected. A guard whose whole purpose is preventing silently-disabled error
  reporting would have silently ENABLED a broken DSN.
  Fix: parse with the SDK (no grammar drift) THEN assert protocol/publicKey/
  host/numeric projectId on the PARSED result, which no build mode can strip.
  Lesson saved: memory/rule_a_library_guard_can_be_compiled_out.md

TWO MORE SURVIVORS CX FOUND IN 8256525, both now killed:
  - every POST -> GET survived all 6 tests. A GET cannot publish. The tests now
    assert exact url, method and Authorization header, not a URL substring.
  - deleting platformPostId/platformPostUrl from the success result survived.
    Those are what fan-out.ts:223 persists, so the published identity was lost.
  - and in the sentry suite, `enabled: isUsableDsn(undefined)` left 24/24 green:
    the suite extracted the validator but never checked it gates real init.

CC PROCESS FAILURE TO RECORD: while testing the identity mutant CC got a FALSE
PASS — reported 6 passed, i.e. mutant survived. It had never applied; the string
replacement silently matched nothing. Re-run from a script FILE with a line-count
guard, it failed correctly. Second time in one session that inline shell escaping
corrupted an edit (the first stripped backslashes out of a regex assertion). All
edits now go through script files or the Write tool, per the carryover rule.

STILL NOT DONE, and deliberately:
  PKG-1 / PKG-2 — unimplemented, specs unapproved. CX confirmed deferring was
    correct and stated this review does NOT authorize live publishing changes.
  PKG-5 — blocked on EVIDENCE, not effort. P0-4 (the live Facebook post) has
    never run. oauth-config.ts: Facebook needs pages_manage_posts, Threads needs
    threads_content_publish — distinct permission surfaces, so Facebook working
    would not clear Instagram/Threads even once it is proven. Setting those
    blockers to null would swap one unverified claim for another.
    THIS AFFECTS THE LOCKELUM PLAN: Instagram and Threads are NOT pre-cleared.
  PKG-7 — first by joint agreement, blocked on Brad naming which of the 41 repos
    carry live client traffic. Neither agent can derive it.

CX residual notes, NOT defects in these commits, for the plan:
  - twitter.ts:96 asserts Twitter v2 has no upload equivalent; the current
    official POST /2/media/upload docs contradict it. Predates tonight.
  - mastodon.ts:51 still returns the attachment id immediately (that is PKG-2).
  - "Universal target safety" of the @sentry/core import is UNPROVEN: measured by
    isolated esbuild bundling, not a full Next build or deployed edge execution.
    No client bloat and no unresolved node builtins were observed.
## N. WORK DONE OVERNIGHT 2026-09-28 — NOT YET PUSHED, NOT YET CX-APPROVED

Four commits on main, LOCAL ONLY. c04ff6c..ebc006b. Nothing pushed, nothing
deployed: Brad was asleep and a push auto-deploys to production.

    07d3bfa  test(media)   PKG-4 / P2-D  byte equality on reddit + mastodon uploads
    8256525  test(twitter) PKG-4 / P2-E  new twitter-media.test.ts, 6 tests
    e1a0be7  fix(sentry)   PKG-3 / P2-C  isUsableDsn delegates to makeDsn, 3 configs
    ebc006b  chore(deps)   self-caught   @sentry/core declared directly, pinned 10.41.0

Suite 406 -> 418 tests, 35 -> 36 files. tsc exit 0. next build: "Compiled
successfully" (prerender fails on the missing local Clerk key — the documented
local-only condition, not a regression).

MUTATION EVIDENCE, every mutant reverted with md5 confirmed:
  P2-D  new Uint8Array(0) in reddit+mastodon -> 2 FAIL ("expected +0 to be 10").
        This is CXs exact surviving mutant; it previously left all 10 GREEN.
  P2-E  three mutants, each killed PRECISELY:
        1 CXs stub (immediate failure return in post())  -> all 6 FAIL
        2 media dropped from body, post still succeeding -> only the 2 media tests FAIL
        3 policy swapped to Reddits (fail on upload fail) -> ONLY the policy test FAILS
        Mutant 3 proves the assertions DISCRIMINATE rather than failing broadly.
  P2-C  one config regressed to the hand-rolled parser -> 3 FAIL, including
        "guard accepts what the SDK rejects" — the actual defect class.

TWO THINGS CC GOT WRONG AND CORRECTED ITSELF:
  1. Asserted twitter uploads a Blob in a file field, mirroring reddit/mastodon.
     WRONG — twitter sends base64 TEXT in media_data (twitter.ts:110). The test
     failed, the implementation was read, the assertion was corrected to the real
     contract. A sibling distributors shape is not evidence about this one.
  2. Inferred makeDsn requires a 32-hex key and that abc123 was a fictional
     fixture. WRONG — abc123 is ACCEPTED; bad-key is rejected for the HYPHEN.
     Probed before changing the fixtures, so no test was weakened on a bad guess.

ONE REAL BEHAVIOURAL FINDING, changed the design:
  makeDsn ACCEPTS a trailing-newline DSN (verified against the installed SDK).
  Pure delegation would therefore have REGRESSED the untrimmed case that an
  earlier fix existed to close. The trim guard is retained AHEAD of delegation,
  the guard is deliberately stricter than the SDK in exactly that one place, and
  the equivalence test is ONE-DIRECTIONAL: the guard may reject what the SDK
  accepts, never the reverse. A two-way equivalence assertion would have been
  false, and writing one would have hidden this.

WHY CC STOPPED HERE — the accuracy boundary:
  PKG-1 (reschedule/dispatch) and PKG-2 (mastodon readiness) were NOT started.
  Both have CX-authored acceptance specs in section I that require joint
  approval of the SAME spec version before implementation, and both change LIVE
  PUBLISHING behaviour. PKG-1 also has to cover the cancelled/stale cron path
  (P1-A2) which CC originally missed. Implementing either overnight on CCs own
  reading of a spec CC did not approve is the exact drift the process reset
  exists to stop.
  PKG-5 (Meta blocker) was ALSO not done, and the reason matters: CC went to do
  it and found there is NO EVIDENCE to correct the value TO. P0-4 (the live
  Facebook post) has never run — the plan says "cannot proceed until John
  accepts". oauth-config.ts shows Facebook needs pages_manage_posts while
  Threads needs threads_content_publish: genuinely DISTINCT permission surfaces,
  exactly as CX argued. Setting those blockers to null tonight would have
  replaced an unverified claim with another unverified claim.

NEXT: CX review of these four commits is running. NOTHING PUSHED until CX
returns APPROVE and CC agrees — Brads instruction was that both must agree
before moving forward.

## L. GATE

    End goal            BUILD.md, quoted in section A. Roles 1-3 are the revenue.
    Checkpoint          c04ff6c (on origin/main)
    Package completed   AUDIT ONLY. Zero code changes.
    Evidence            406/406 green; tsc exit 0; 5 CC mutants injected and
                        reverted md5-identical; 6 findings; CX effort=medium x2
    Current gate        CX review of THIS v2 (v1 returned CHANGES REQUIRED)
    CX approval         PENDING on v2
    CC approval         PENDING — CC has approved nothing of its own
    Next authorized     CX reviews v2 and rules on PKG-0 (the endpoint
                        reconciliation). NO implementation until CX and CC approve
                        the SAME package spec version.
    CLAW_GATE_2_STATUS  PENDING — CFC is sole VERIFIED_DONE authority

## M. DECISIONS GENUINELY REQUIRING BRAD

1. Confirm BUILD.md + FANOUT-BUILD-PLAN-2026-09-22.md are the authoritative end
   goal and plan, or name a newer Notion source to reconcile against.
2. PKG-7: which of the 41 repos carry live client traffic. Neither agent can
   derive this — a repo cannot tell you what is deployed.
3. Is /api/engine/submit intended, or drift? If unknown, it goes to CX as PKG-0
   rather than to Brad.
4. Resend: exact amount + vendor + the words "confirm spend", in one message.
5. website-engine 00e1b20 — push to production or leave unpushed.
6. YouTube: community posts vs real video publishing (product call).
7. CFC is UNUSED. It gates the org-creation P0 — which blocks ROLE 3, the SaaS
   revenue. Nobody has watched a genuinely new user sign up. Brad must do the
   signup himself in a NEW CHROME PROFILE (not incognito — CFC cannot see it).
