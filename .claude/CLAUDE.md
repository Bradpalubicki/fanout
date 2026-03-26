## Global Living System
Read before every session:
https://www.notion.so/32f663704e4081afb964eddeab7b40e1

## Agent Inbox
Check at session start:
https://www.notion.so/32f663704e4081f3ac93e81a3782412a

# Fanout — Claude Code Instructions

## Project
- **Name:** Fanout (fanout.digital)
- **Repo:** C:/Users/bradp/dev/fanout
- **Stage:** BUILT / PARTIALLY BROKEN — 9/13 social platforms non-functional (OAuth apps unregistered)

## Read First
- `OPERATING_BIBLE_v2.html` — full system spec
- `NOTES.md` — known blockers

## Stack
- Next.js 16 App Router | Supabase + RLS | Clerk org-level auth | Square payments
- Inngest background jobs | Resend email | Sentry | PostHog
- 13 social platform distributors in src/distributors/

## Platform Status
- ✅ WORKING: Bluesky, Mastodon
- ❌ BROKEN (need OAuth app creds): Reddit, Twitter/X, LinkedIn, YouTube, Pinterest
- ❌ BROKEN (need Meta Business Verification): Facebook, Instagram, Threads
- ❌ BROKEN (need TikTok app review): TikTok
- ⚠️ UNTESTED: Google Business Profile

## Test User
- Email: demo@fanout.com
- Password: TestPass2026!

## Critical Env Vars (Vercel)
TOKEN_ENCRYPTION_KEY, TWITTER_CLIENT_ID/SECRET, REDDIT_CLIENT_ID/SECRET,
LINKEDIN_CLIENT_ID/SECRET, YOUTUBE_CLIENT_ID/SECRET, PINTEREST_APP_ID/SECRET,
FACEBOOK_APP_ID/SECRET, INSTAGRAM_APP_ID/SECRET, THREADS_APP_ID/SECRET,
TIKTOK_CLIENT_KEY/SECRET, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID,
SQUARE_WEBHOOK_SIGNATURE_KEY, CLERK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY

## Session Start Sequence
1. Read this file + OPERATING_BIBLE_v2.html
2. Check Linear open issues (fanout project)
3. Check Sentry unresolved issues (fanout)
4. Check Vercel deployment status
5. Run brain_ambient_brief
