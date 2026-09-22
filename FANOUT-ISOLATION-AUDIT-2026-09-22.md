# FANOUT — SERVICE ISOLATION AUDIT (2026-09-22)
Goal: fanout.digital owns its own accounts; shares nothing with other NuStack projects.

## DEDICATED ALREADY — no action
| Service | Value | Note |
|---|---|---|
| Supabase | jifhgpwiqgwkgqtmozsu ("fanout") | own project; marketing-engine is ftuneexcrtpagrfntbkk |
| Inngest | id: 'fanout' (src/lib/inngest.ts:4) | own app id |
| Vercel project | prj_oBCFaGcm… ("fanout") | own project |
| Domain | fanout.digital + www | owned by the fanout project |
| Meta/FB app | 772426605937002 | own app, creds validated live |

## SHARED / WRONG — must fix
| # | Service | Problem | Risk |
|---|---|---|---|
| S1 | Clerk | No production instance. `fanout.digital` root domain was held by a DEAD "Marketing SEM & Client Side" prod instance (0 sign-ups, clerk.fanout.digital never in DNS). Fanout runs a pk_test_ DEV instance in production. | Outside users on a dev instance: user caps, dev banner, Clerk-branded Google consent. BLOCKER for John/OPP. |
| S2 | Square | SQUARE_LOCATION_ID=LN64VJ45Q6HQ2 = "NuStack Digital Ventures LLC" company-wide merchant, SQUARE_ENVIRONMENT=production | Outside customers' subscription payments land in the shared NuStack merchant. No per-product separation of funds/reporting. |
| S3 | marketing-engine | Has NO domain of its own; borrows marketing.fanout.digital. Its Clerk auth is already broken (clerk.fanout.digital unreachable, /dashboard 404). | Couples an unrelated project to Fanout's root domain. Needs its own domain + Clerk. |

## PLACEHOLDER (not shared, but non-functional)
RESEND_API_KEY, REPLICATE_API_TOKEN, FIRECRAWL_API_KEY, NEXT_PUBLIC_SENTRY_DSN,
NEXT_PUBLIC_POSTHOG_KEY = literal "placeholder"/"PLACEHOLDER".
=> No transactional email, no image gen, no scraping, no error monitoring, no product analytics.
   Resend matters most: a SaaS with outside users cannot send password/invite/receipt email.

## UNVERIFIED
GA id G-2R5Z08ZJPF — could not confirm whether other NuStack sites use the same property.
Needs a check in Google Analytics admin (not resolvable from this repo).

## ORDER
1. S1 Clerk prod instance (in flight via CFC) — blocks the pilot
2. Resend own API key + verified sending domain on fanout.digital — blocks outside users
3. S3 give marketing-engine its own domain + Clerk (unblocks nothing for Fanout, but removes the coupling)
4. S2 decide: own Square location for Fanout, or accept shared NuStack merchant (business call, needs Brad)
5. Sentry + PostHog real keys before external launch


## RESEND FINDING (2026-09-22)
fanout.digital is NOT one of the 22 domains in Resend => Fanout CANNOT SEND EMAIL AT ALL.
No password reset, no org invite, no receipt. Hard blocker for outside users, independent of Clerk.
create-domain FAILED: 403 "You have reached the domain limit of your plan. Upgrade to add more."
=> needs either a plan upgrade (SPEND - Brad only) or removing an unused domain.
Dead candidates (Resend status=failed AND domain does not resolve):
  stylistengine.io   (failed, DNS 000)
  wellnessengine.io  (failed, DNS 000)
Other non-verified but LIVE sites (do not remove without checking):
  kidcreatives.art (200), appraiserfound.com (200), vetsthrive.org (200),
  appraiserengine.com, akultimatedental.com, veteransthrive.org
KEEP: nustack.digital (partially_failed but core).
