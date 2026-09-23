# CFC VISUAL + FUNCTIONAL AUDIT — FANOUT — 2026-09-23

SITE: https://www.fanout.digital
NOTE: apex fanout.digital 308-redirects to www. Always use www.
DEPLOY UNDER TEST: dpl_DFoYaXC4rro1mfH7adfQhrrteWb4 (SHA 1410ee8c)

## HARD RULES
- CFC ENTERS NO CREDENTIALS. No passwords, no API keys, no token pasting.
  Brad logs in manually if a signed-in view is needed. (locked rule)
- Do NOT click anything that spends money or sends external comms.
- Do NOT trigger browser dialogs (alert/confirm) — they freeze the session.
- Report what you SEE. A screenshot is the evidence; prose is not.

## WHY THIS RUN EXISTS
Sign-in went live hours ago after a 3.5h Clerk cert outage and an Organizations
flag that had 48/48 API routes returning 401. Nobody has yet LOOKED at the site
with working auth. Every prior verification was curl + SQL.

## PART 1 — SIGNED-OUT, ALL VIEWPORTS
Viewports: 375px, 390px, 768px, 1440px.
Pages: / · /pricing · /docs · /blog · /privacy · /terms · /sign-in · /sign-up
For each, capture a screenshot and report:
 - Does the Clerk sign-in widget actually RENDER on /sign-in and /sign-up?
   (This is the headline check. The cert was broken until 02:10Z; a stale
   cached bundle would show a blank box where the form should be.)
 - Any horizontal scroll at 375px.
 - Hero using 100vh instead of calc(100svh - 60px) — mobile chrome overlap.
 - Placeholder/lorem text, broken images, dead links, overlapping elements.
 - Pricing page: the numbers shown. Report them EXACTLY. Structured data in
   the page source advertises Starter $49 / Agency $199 / White-Label $399 —
   flag ANY mismatch between the rendered page and those figures.

## PART 2 — SIGN-UP FLOW (the pilot's actual first 60 seconds)
John must SIGN UP FRESH on the prod instance; his old account is on the dev
instance and will not work. Walk the flow as a new visitor WITHOUT completing
it (stop before submitting real details) and report:
 - Is the path from / to a usable sign-up obvious? Count the clicks.
 - After sign-up, the app expects an ORGANIZATION. dashboard/page.tsx:42-55
   renders Clerk's <OrganizationList> for org-less users. Nothing in the
   codebase calls createOrganization — the user MUST create the org themselves
   in that widget. Confirm the widget renders and that the next step is
   self-evident to someone who has never seen it. If a new user can land in a
   dead end with no org and no visible way forward, that is a P0 for the pilot.

## PART 3 — SIGNED-IN (Brad drives login; CFC observes)
Pages: /dashboard · /dashboard/compose · /dashboard/profiles · /dashboard/social
       /dashboard/inbox · /dashboard/calendar · /dashboard/analytics
       /dashboard/settings · /dashboard/billing · /dashboard/approvals
For each: does it RENDER, or does it error/spin/blank? Screenshot each.
Expect empty states everywhere (oauth_tokens=0, post_results=0, inbox_items=0).
 - An honest empty state ("No posts yet — connect an account") is a PASS.
 - A spinner that never resolves, a raw error, NaN, "undefined", or a chart
   rendering with no data is a FAIL. Report which.
 - Report any page whose empty state gives the user no next action.

## PART 4 — CONSOLE + NETWORK
On every page above, collect console errors and failed network requests.
Specifically flag: Clerk handshake failures, 401/403/500 on XHR, CSP
violations, and any request to a clerk.* or *.supabase.co host that fails.

## OUTPUT
A table: PAGE | VIEWPORT | RENDERS? | DEFECTS | SCREENSHOT
Then the top 5 defects ranked by pilot impact, each with the screenshot that
proves it. Then one line: VERDICT: PILOT-READY | NOT PILOT-READY + why.
