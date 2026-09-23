cd C:\Users\bradp\dev\fanout

## STATE AS OF 2026-09-22 ~18:40 PT — ONE EXTERNAL BLOCKER, EVERYTHING ELSE LIVE

Clerk keys are DONE. Deploy is GREEN. Code + DB fixes are LIVE.
The only open item is a Clerk-side SSL cert that has not issued.

## FIRST COMMAND — is sign-in up yet?
  curl -s -o /dev/null -w '%{http_code}\n' https://clerk.fanout.digital/v1/environment

  200 -> sign-in works. Tell CFC "rerun 4 and 6". John can connect.
  000 -> still stuck. See CLERK BLOCKER below.

## WHAT SHIPPED (verified live, not claimed)
- Deploy dpl_61sxFrBvVJjZE4UAwp6gxrwyeovA = READY, SHA 3433d7f, aliased to
  fanout.digital + www.fanout.digital. First green build after 6 ERRORs.
- F1 decrypt retry: TokenCorruptError (skip+log) vs TokenDecryptUnavailableError
  (rethrow -> Inngest retries). Classifier verified against the LIVE db:
  wrong key = SQLSTATE 39000, malformed input = 22023, round-trip still true.
- F2 reply delivery: all 5 transports (fb/ig/twitter/youtube/linkedin) now call
  assertDelivered(). fetch() resolves on 403 — none of them checked res.ok, so a
  rejected reply returned 200 and the item was marked 'replied'. Route now
  returns 502 and leaves the item queued.
- F3: step counts read from step.run return values, not a closure lost on replay.
- Migration 017: anon had SELECT/INSERT/UPDATE/DELETE on EVERY table incl
  oauth_tokens and two_factor_codes, with RLS as the only barrier. Anon is now
  denied at the GRANT layer (insufficient_privilege, before RLS). short_links
  keeps its intentional public read. service_role still reads real data
  (profiles=2, org_subscriptions=3 — non-zero = availability control).

## CLERK BLOCKER (the only thing open)
Domain fanout.digital / instance ins_3JhcXd7I0OQpSeT0fruGzXyzw1j shows
Unverified (Frontend API, Account portal, Email 0/3). No SSL cert issued.
Created 2026-09-22T22:39:41Z. Still Unverified ~3h later vs Clerk's <=1h SLA.

TWO "Verify Records" clicks left the domain record's updated_at at
2026-09-22T23:03:51Z (a CC PATCH). Neither click registered server-side.

RULED OUT — do not re-investigate:
- DNS is correct from GoDaddy authoritative NS (ns23/ns24.domaincontrol.com),
  1.1.1.1, 8.8.8.8, and Google DoH. All 5 CNAMEs match Clerk's own dns_targets.
- No CAA records. No conflicting A/AAAA/TXT at the clerk subdomain.
- Not a local TLS problem (cloudflare.com = 200 from this machine).
- Direct SNI test to Clerk's edge IP 104.18.34.146 gets a fatal TLS alert =
  no certificate exists for clerk.fanout.digital.
- Clerk exposes NO verification API endpoint. Probed POST/PUT on
  /v1/domains/{id}/verify, /verify_dns, /verify_dns_records,
  /dns_records/verify, /check, /ssl_certificate, /v1/dns_checks,
  /v1/proxy_checks — all 404/405. PATCH returns 200 but does not verify.
  It is dashboard-only.

NEXT ACTION: CFC files a Clerk support ticket (full text is in the session
transcript). Or it clears on its own overnight.

## KEYS (already set, do not redo)
pk_live_Y2xlcmsuZmFub3V0LmRpZ2l0YWwk -> decodes to clerk.fanout.digital
sk_live_ set in Vercel production. Pair match PROVEN: the secret's instance
owns fanout.digital with frontend_api_url https://clerk.fanout.digital.

## CFC CHECK STATE
PASS: 1 (READY), 2 (SHA contains 306c278e), 3 (bundle ships pk_live_),
      5 (/ 200, /dashboard 307), 7 (bogus key -> 401)
FAIL: 4 (clerk FAPI TLS), 6 (sign-in widget blank, failed_to_load_clerk_js)
Both FAILs have ONE cause: the missing cert. Nothing else is wrong.

## DO NOT LET JOHN SIGN UP until check 4 returns 200.
Site loads, but the Clerk widget cannot reach clerk.fanout.digital.

## STILL OPEN (deliberately held, not on the pilot path)
F4 developer-apps callbackEnv decorative (save-platform-credentials.ts:72) —
   design change
F5 product_platform_accounts encrypt/read mismatch — separate table, unused
F6 Instagram/Threads Meta redirect URIs — browser-only Meta console state
John Farmer has not accepted the Meta Tester invite (app 772426605937002).
Verify him server-side: select count(*) from oauth_tokens; expect 1.

## NOTION
CC Work Queue row: 3e4663704e4081ffbc20e678b235598f (State = BUILDING)
Active Sequences: fanout block filed 2026-09-22 (360663704e408103b843ca3fc822e450)
Supabase: jifhgpwiqgwkgqtmozsu
CLAW_GATE_2_STATUS: PENDING — CFC is the sole VERIFIED_DONE authority.
