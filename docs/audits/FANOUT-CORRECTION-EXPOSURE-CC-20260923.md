# Independent CC review — Fanout correction and exposure plan

Verdict: APPROVED for G0 planning only. No implementation, rollout, provider activity, schema deployment, or product-readiness approval. No unresolved plan-review disagreement.

Exact reviewed plan: docs/audits/FANOUT-CORRECTION-EXPOSURE-PLAN-20260923.md, SHA256 B6F7717BE8D869AA555EF4CF98C8110C8C8282A7F9FCF7D39267FC2A38C5DF5E.
Source HEAD independently confirmed: 7dd7caea6abf1636484a96a80a0d0bb4c1b4a4cf; 22 descendants after requested 15c2fdcedf3ffde6e945e827471980e5bcfda5ae.
Preserved worktree: twitter.ts SHA256 911848D24633C97785E1B363D58CFE9BA1C9D42D0A2F7B1161479B25387D11D6; linkedin.ts SHA256 D4945A05D43F9D3C273D2A2E92F37BB36983503146B3140F29B8B6C485C27C09; BIBLE-UPDATE-NEEDED.md remains preexisting dirty documentation.

## Independent findings and reconciliation

CC inspected source/Git before receiving the plan, independently of CX findings. The following independently identified source defects are addressed by the exact plan; they remain unfixed and are not accepted product behavior:

- P1 worker authority pairing: src/lib/fan-out.ts:52 reads post by id while :65 selects tokens from independent profileId; scheduled-post.ts:22, retry-post.ts:31, and fan-out-post.ts:51 pass event tuples. Actual-source in-memory probe dispatched B content with A token and recorded four mocked writes. Plan P0 item2 requires rejection before tokens/effects and derives authority from durable jobs.
- P1 conditional machine-auth fail-open: src/app/api/cron/process-queue/route.ts:8 accepts literal Bearer undefined when CRON_SECRET is absent. Actual-source in-memory GET probe with missing secret returned status200, dbReads1, queueCalls1, processed1. Deployed configuration/exploitability UNPROVEN. Plan P0 item4 requires fail-closed sibling review.
- P1 latent private-to-public dispatch: dashboard/inbox/route.ts:155 rejects DM for Meta, but :168/:184/:203 select other public reply transports without type restriction. Actual-source sendPlatformReply probe with type dm rejected Facebook/Instagram with zero mocked calls; Twitter/YouTube/LinkedIn resolved with one mocked provider call each. Plan P0 item5 and D gate require all-transport rejection before token/provider work.
- P2 history completeness: history/route.ts:75/:81/:94 use timestamp-only order/cursor; backfill-history.ts:180-184 derives page budget from imported row count. Plan H explicitly requires tie-breaker/null policy, actual page budget, repeated-cursor protection and non-success partial states. Behavioral closure remains pending.
- Verification limit: tests/api/v1-history.test.ts:12-44 and tests/api/v1-account-analytics.test.ts:8-23 record filters but return canned rows; backfill-history.test.ts uses source assertions. Existing passes cannot prove full A/B/C isolation. Plan mandatory gate requires real resolver, predicate-enforcing stateful fixtures, positive A controls, B and C negatives, mutations, and worker/provider/effect observation.

CC additionally reopened biolink PATCH (:99-113), dashboard generate-content (:24-36), downstream generate-social-content (:55-57,180-189), product-profile (:31-56), and OAuth select-page (:18-25,63-70,129-185) and confirmed the source basis for the plan's adjacent ownership, authority-promotion and credential-projection correction scope. No deployed behavior is inferred.

## G0 acceptance

- Current HEAD and subsequent changes reconciled, including newly built history/account analytics and preserved dirty distributors; original diagnosis narrative completeness honestly UNPROVEN.
- Separate scopes, effort ranges and falsifiers for H/C/D/A/U/V, plus prerequisite P0. Estimates are engineering judgments, not measured commitments; provider feasibility and waits excluded or conditional.
- Profile A key cannot inherit organization, admin, internal-product or fleet authority. A succeeds while sibling B and foreign C are denied across reads, counts, mutations, token selection and queued/provider effects.
- Source correction approval, local integration acceptance, staging/provider verification, and deployment exposure are separate gates. Live provider behavior and deployed schema remain UNPROVEN.
- Exact package review and CX/CC agreement precede advancement. A separate build instruction is required; G0 approval alone authorizes no product changes.

## Commands and actual output

Working directory: C:/Users/bradp/dev/fanout. Shell tools required escalation because the default launcher failed SetTokenInformation 1344; all source inspection and probes remained local, with network/provider dependencies mocked.

```powershell
git rev-parse HEAD
git rev-list --count 15c2fdcedf3ffde6e945e827471980e5bcfda5ae..HEAD
git log --oneline 15c2fdcedf3ffde6e945e827471980e5bcfda5ae..HEAD
git diff -- src/distributors/linkedin.ts src/distributors/twitter.ts
Get-FileHash docs/audits/FANOUT-CORRECTION-EXPOSURE-PLAN-20260923.md
Get-FileHash src/distributors/twitter.ts,src/distributors/linkedin.ts
```
Actual HEAD, count and hashes match this review. Dirty diff: LinkedIn author selection; Twitter remote media fetch/upload and text-only fallback. Neither dirty change is approved here.

Executed commands:
```powershell
rg -n --glob '*.py' --glob '*.js' --glob '*.html' --glob '*.ts' --glob '*.tsx' 'fanout/history.backfill|backfill.requested|history/backfill|backfillHistory|collectAccountAnalytics|verifyInternalKey|verifyApiKey|validatePost' .
rg -n --glob '*.py' --glob '*.js' --glob '*.html' --glob '*.ts' --glob '*.tsx' 'social/history.backfill|social/account-analytics.collect|sendPlatformReply|/api/dashboard/inbox|/api/upload|validatePost|\.validate\(' .
rg -n --glob '*.py' --glob '*.js' --glob '*.html' --glob '*.ts' --glob '*.tsx' 'fanOut\(' .
npm test -- tests/api/v1-history.test.ts tests/api/v1-account-analytics.test.ts tests/lib/backfill-history.test.ts tests/security/tenant-scoping.test.ts
git diff --check
```
Whole-repository searches traced auth, API handlers, dashboard callers, collector registration and worker call chains. HTML documentation hits were not behavioral evidence. No broad absence claim is made. Actual focused tests: Test Files 4 passed (4); Tests 56 passed (56); Duration312ms; exit0. git diff --check exit0, existing BIBLE LF/CRLF warning only.

Actual-source probes used typescript.transpileModule to CommonJS, new Function with explicit mocked require, and local in-memory inputs. sendPlatformReply was exported in memory only; fetch was a mock returning Response200. Cron mocked Supabase and Inngest; CRON_SECRET removed only in the child node process. fanOut mocked distributors, decryptToken and stateful query/effect capture. No source files were transformed on disk and no real provider/queue calls occurred. These are local behavioral counterexamples, not full mandatory isolation-gate passes. CX's independently produced worker/schema probe is recorded separately by the plan and is not the basis for CC's independent findings.

## Falsification and next gate

G0 approval is invalid if the reviewed plan/hash or source basis changes, a required package omits A/B/C effect isolation, broader authority is silently inherited, estimates are presented as guarantees, or any source/mock result is promoted to live/schema proof. Reopen review on such drift.

Product exposure remains NO-GO. Mandatory A/B/C integrated gate is NOT VERIFIED. Next authorized action: present jointly reviewed plan to Brad; no implementation until separately instructed. Plan-checkpoint approval does not approve existing dirty code or any completed implementation package.

