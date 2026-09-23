# FANOUT -> AYRSHARE PARITY — BUILD PLAN
Measured against HEAD 0627b16, live prod, live DB. 2026-09-23.
Revises the CFC/CA competitive plan using what the code actually contains.

## THE FINDING THAT CHANGES THE PLAN
The strategy doc costs ~13 API groups at 3 days-2 weeks each (~10 weeks). That
assumes they must be BUILT. Measured: almost all already exist and work — behind
Clerk sessions instead of API keys.

    /api/dashboard/*  = 22 routes, session-gated
    /api/v1/*         =  7 routes, API-key gated

The engines are shared. The public API is a thin, mostly-absent projection of a
dashboard that already does the work:

| "Missing" group  | What already exists |
|---|---|
| Comments         | collect-inbox.ts collects FB/IG comments (*/15 cron); sendPlatformReply() replies on 5 transports with assertDelivered() (the F2 fix) |
| Messages/DMs     | same inbox_items table + same reply transports |
| History          | posts + post_results store every post with its platform id |
| Analytics (acct) | collect-analytics.ts cron + getAnalytics() on all 12 distributors; only /v1/analytics/[postId] is exposed |
| Media            | /api/upload exists |
| Auto-schedule    | scheduled-post.ts + /dashboard/post/[id]/reschedule |
| Feeds (RSS)      | rss-auto-post.ts + rss_feeds table + dashboard UI |
| Links            | /dashboard/links + /api/links + biolink analytics |
| AI generate      | /api/ai/draft + /dashboard/generate-content |
| Approvals        | /dashboard/approvals (spec'd, built) |
| Profiles         | SHIPPED 0627b16 (plan estimated 4-5 days) |

The dominant Phase-2 cost is NOT construction. It is:
  (a) auth swap: Clerk auth() -> verifyApiKey() from src/lib/auth.ts
  (b) response-shape stabilisation (a public contract we cannot later break)
  (c) tests + docs per endpoint

### The one real semantic blocker
Dashboard handlers resolve orgId from the session, then fan out across ALL
profiles in the org (filter on org_id, producing a profileIds array). An API key
identifies exactly ONE profile — verifyApiKey returns a Profile, which carries
org_id. That is a NARROWING, not a blocker, and it is the correct scope for a
customer key. Every ported route must scope to the key's profile, not the org.
Getting this wrong is a cross-tenant leak — the #1 thing to test.

## REVISED COSTING
- Phase 2 as specified: ~10 weeks of building.
- Phase 2 measured: ~2-3 weeks of exposing + testing + documenting.

Biggest schedule saving available, and it is free — it comes from reading the
repo rather than the marketing gap.

## WHAT THE PLAN GETS RIGHT (keep unchanged)
- The wedge: reselling under the agency brand with AI + approvals is a position
  Ayrshare does not hold. Parity is the floor, not the pitch.
- "List a platform as live only when a real test post has gone out from
  production." Correct rule, and the antidote to the error class below.
- Counsel reviews competitor copy before launch.
- Phase discipline: nothing in Phase 3 until Phase 1 passes CFC.

## WHAT IS WRONG, AND WHY IT MATTERS

### 1. "0 of 9 post in production" is UNPROVEN, not measured
Both the strategy doc and the CFC audit derive this from /dashboard/social,
which reads src/lib/integration-status.ts. That file makes ZERO network calls
(grep -c fetch = 0) and holds 6 HARDCODED status literals. Its header comment
claims it "attempts a read call to verify each platform" — it does not. It
reports BROKEN/NEVER_SETUP purely from env-var presence.

Its own text gives it away:

    "OAuth app exists but no user has connected a Twitter account via OAuth flow"

That is not "posting is broken". That is oauth_tokens = 0 — which we already
knew. Nobody has connected an account. Untested != broken.

Consequences:
- Bluesky/Mastodon read WORKING for the same hollow reason (env vars present,
  username/password not OAuth). No post was verified there either. CLAUDE.md
  already says to treat them as UNPROVEN.
- The "45 min each" fix times are hardcoded strings in that same file, not
  estimates anyone derived. The plan inherits them as if measured.

### 2. So Phase 1's premise is half-wrong
Phase 1 is right that platforms must be proven; wrong that we know which are
broken. The first action is not "register 5 OAuth apps" — it is ONE real
connection plus an honest status page. Registering apps for platforms whose
distributors have never been exercised risks 5x rework.

## REVISED PLAN

### PHASE 0 — MAKE THE INSTRUMENTS HONEST (days) — DO FIRST
- 0.1 Rewrite integration-status.ts to make a real read call per platform. Today
  it is a lying dashboard and two planning docs already drew false conclusions
  from it.
- 0.2 John connects ONE account end to end: oauth_tokens >= 1 and a real
  platform_post_id in post_results. Converts every guess into a fact.
- 0.3 Fix false copy: Ayrshare price quoted two ways ($149 vs $648); "same
  9-platform coverage"; Starter 9-vs-5. NOTE: no platform limit is enforced
  ANYWHERE in code — plan limits are UI strings in dashboard/billing/page.tsx,
  so this is a missing gate, not just copy.

GATE: no platform advertised until a real post has gone out from production.

### PHASE 1 — EXPOSE WHAT EXISTS (~2-3 wks, not 10)
Port dashboard engines to /api/v1 behind verifyApiKey, scoped to the KEY's
profile. Ordered by customer value:
1. history — Ayrshare leads its AI pitch with this; our data is ready
2. analytics/account — collector already runs nightly
3. comments — collector + 5 reply transports already exist
4. media — /api/upload exists
5. validate — new, small, pure function, no I/O; cheapest real build
6. messages/DMs — same table, same transports
7. auto-schedule, feeds, links — thin projections

Each ships with: profile-scoping test, OpenAPI entry, docs row.

### PHASE 2 — THE WEDGE (what Ayrshare lacks)
White-label domains/branding, branded connect page, approval-by-link, reseller
billing, AI calendar + brand voice, MCP server.

MCP is cheap BECAUSE Phase 1 exists — a thin wrapper over /api/v1. Build it
AFTER, never before: 27 tools over unproven endpoints is the most expensive way
to discover they do not work.

### PHASE 3 — BREADTH + PROOF
Remaining networks as reviews clear; Telegram (no review needed, cheapest new
network); status page fed by the REAL probes from 0.1; pilot case study.

## WHAT RUNS IN PARALLEL (the real time saving)
Independent tracks, no shared files, no merge contention:

- **A. Platform/OAuth registration** — BRAD. External reviews take days-weeks of
  waiting. Start immediately: it is the long pole and costs zero engineering.
- **B. /api/v1 exposure** — CC. Mechanical, test-guarded, safe now that a
  91-test suite exists.
- **C. OpenAPI + SDK generation** — generated FROM B; starts when B's response
  shapes settle, not when B finishes.
- **D. Copy/legal/pricing** — BRAD + counsel. Zero code dependency.
- **E. Status page + network matrix** — depends ONLY on 0.1, not on B.

Serialised by necessity: MCP (needs B), case study (needs John), anything
Meta-gated (needs Brad's verification).

## AGENT ASSIGNMENT — FROM MEASURED PERFORMANCE TODAY
- **CC** — build + live verification. Owns track B.
- **CFC** — visual/UX verification of criteria it did not write. Today it found a
  real tenant-visible leak and correctly refused to create an account. Strong on
  observation.
- **CX** — narrow single-file questions ONLY. Died with exit 0 and no VERDICT on
  SIX long/synthesis prompts today. It also produced one real find (the
  unauthenticated Twilio webhook) and two errors (a gitignored scratch dir; a
  NO-GO verdict from an unfollowed 308). Use for "does X exist in file Y", never
  synthesis. Verify every claim.

## DECISIONS OPEN (Brad)
- [ ] Starter: all networks or 5 — and nothing enforces any limit today
- [ ] AI generation on Starter (FAQ and table disagree)
- [ ] X API paid tier: which, who pays
- [ ] /dashboard/social: now staff-gated (6d9d85a) — keep internal or delete
- [ ] First vertical pack: dental / med spa / men's health

---

## CX REVIEW 2026-09-23 — VERDICT ACCEPTED, ESTIMATE WITHDRAWN
15m23s, exit 0, effort=high, read-only. CX executed the real handlers against
mocked dependencies rather than only reading them. CC verified every load-bearing
claim below against the source before accepting.

### CC WAS WRONG: "narrowing, not a blocker" understated the risk
I wrote that org->profile scoping is "a narrowing, not a blocker". CX proved that
is unsafe as stated. inbox/route.ts:73 authorizes a reply by comparing only the
ITEM's org to the caller's org, then loads the token for the ITEM's profile. For
a Clerk session that is correct — the user owns the whole org. Ported to an API
key unchanged, profile A's key replies THROUGH profile B's token.
CX reproduced it: A-key inbox returned A and B; reply to B returned 200 and
loaded B's token; foreign-org C returned 404.
The correct pattern already exists in v1: analytics/[postId]:34 constrains the
resource by BOTH its id AND auth.profile.id before reading descendants.
=> Every ported route must bind resource lookup, counts, mutation, token
   selection and queued work to the VERIFIED PROFILE. Org-derived authority is
   a separate, higher privilege that an API key does not carry.

### CONFIRMED BY CC, INDEPENDENTLY
- inbox/route.ts:73 org-only reply authorization. VERIFIED in source.
- DM replies route to a COMMENTS endpoint. inbox/route.ts:152 hardcodes
  /{targetId}/comments; `type` only picks the target id. A "dm" reply would post
  a PUBLIC comment. Currently LATENT — the collector never writes type='dm' — but
  it is a private-to-public disclosure the moment DMs are ingested.
- v1/analytics/[postId]:55 reads analytics_snapshots[0] with NO ordering, so a
  public endpoint would report an arbitrary snapshot.
- biolink/route.ts:41 `clicksFor` queries biolink_clicks by a caller-supplied
  page_id with NO ownership check. This is a LIVE cross-tenant read TODAY, not a
  migration risk.

### THE ESTIMATE
"~2-3 weeks of exposure" is WITHDRAWN as a schedule commitment. It rested on
"auth swap plus tests", and CX is right that the six features need different
treatment:
  history  — local post history reusable; NATIVE history (posts made outside
             Fanout) needs provider backfill. Decide which we are selling.
  media    — basic blob upload reusable; note Twitter's adapter discards media
             entirely, so upload success != publish support.
  comments — real collector + 5 transports, but needs completion: profile
             scoping, pagination, ingestion checkpoints, idempotency.
  DMs      — NEW CONSTRUCTION. A `dm` type label exists; no ingestion, and the
             reply path is wrong.
  analytics— account-level is NEW. What exists counts local publishing outcomes
             and per-post metrics.
  validate — scattered rules, not a service. v1 post schema accepted an unknown
             platform, 281 Twitter chars, and Instagram with no media.
CC's error was treating "an engine exists" as "the capability exists". Exposure
is real for a subset; the rest is construction. Re-estimate per feature after
the scope decision below, not as one blanket number.

### SCOPE DECISION REQUIRED BEFORE ANY PHASE 1 WORK (Brad)
Are we selling LOCAL history/analytics (what Fanout sent, cheap, ready) or
NATIVE (what the account did anywhere, which is what Ayrshare sells and which
needs provider sync)? These are different products at different costs.

### THE REGRESSION TEST THAT GATES ALL OF PHASE 1
A's key against: A's resource (succeeds), sibling B in the same org (discloses
nothing, no effect), foreign-org C (discloses nothing, no effect). Until that
holds for a route, that route does not ship.
