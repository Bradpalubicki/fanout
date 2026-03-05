# Fanout — Vercel Env Audit (2026-03-05)

## Env Vars Present in Vercel

| Name | Environments |
|------|-------------|
| FANOUT_ADMIN_KEY | Dev, Preview, Production |
| CLERK_SECRET_KEY | Production, Preview |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Production, Preview |
| NEXT_PUBLIC_GA_MEASUREMENT_ID | Production |
| BLOB_READ_WRITE_TOKEN | All |
| FIRECRAWL_API_KEY | Production |
| SOCIAL_ENGINE_ADMIN_KEY | Preview, Production |
| VERCEL_TOKEN | Dev, Production |
| VERCEL_TEAM_ID | Dev, Production |
| VERCEL_PROJECT_ID | Dev, Production |
| CRON_SECRET | Production |
| THREADS_APP_SECRET | Production |
| THREADS_APP_ID | Production |
| INSTAGRAM_APP_SECRET | Production |
| INSTAGRAM_APP_ID | Production |
| FACEBOOK_APP_SECRET | Production |
| FACEBOOK_APP_ID | Production |
| NEXT_PUBLIC_POSTHOG_HOST | Production, Preview |
| REDDIT_CALLBACK_URL | Production, Preview |
| TIKTOK_CALLBACK_URL | Production, Preview |
| YOUTUBE_CALLBACK_URL | Production, Preview |
| PINTEREST_CALLBACK_URL | Production, Preview |
| FACEBOOK_CALLBACK_URL | Production, Preview |
| LINKEDIN_CALLBACK_URL | Production, Preview |
| TWITTER_CALLBACK_URL | Production, Preview |
| NEXT_PUBLIC_CLERK_* | All |
| INNGEST_SIGNING_KEY | All |
| INNGEST_EVENT_KEY | All |
| ANTHROPIC_API_KEY | All |
| TOKEN_ENCRYPTION_KEY | All |
| SUPABASE_SERVICE_ROLE_KEY | All |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | All |
| NEXT_PUBLIC_SUPABASE_URL | All |

## Missing from Vercel (Referenced in Code)

| Env Var | Referenced In | Status |
|---------|--------------|--------|
| SQUARE_APP_ID | lib/square.ts (indirect) | **MISSING** — needs placeholder |
| SQUARE_ACCESS_TOKEN | lib/square.ts | **MISSING** — needs real key |
| SQUARE_LOCATION_ID | lib/square.ts | **MISSING** — needs real key |
| SQUARE_ENVIRONMENT | lib/square.ts | **MISSING** — needs `sandbox` or `production` |
| TWITTER_CLIENT_ID | lib/oauth-config.ts | **MISSING** — needs placeholder |
| TWITTER_CLIENT_SECRET | lib/oauth-config.ts | **MISSING** — needs placeholder |
| LINKEDIN_CLIENT_ID | lib/oauth-config.ts | **MISSING** — needs placeholder |
| LINKEDIN_CLIENT_SECRET | lib/oauth-config.ts | **MISSING** — needs placeholder |
| REDDIT_CLIENT_ID | lib/oauth-config.ts | **MISSING** — needs placeholder |
| REDDIT_CLIENT_SECRET | lib/oauth-config.ts | **MISSING** — needs placeholder |
| YOUTUBE_CLIENT_ID | lib/oauth-config.ts | **MISSING** — needs placeholder |
| YOUTUBE_CLIENT_SECRET | lib/oauth-config.ts | **MISSING** — needs placeholder |
| PINTEREST_APP_ID | lib/oauth-config.ts | **MISSING** — needs placeholder |
| PINTEREST_APP_SECRET | lib/oauth-config.ts | **MISSING** — needs placeholder |
| TIKTOK_CLIENT_KEY | lib/oauth-config.ts | **MISSING** — needs placeholder |
| TIKTOK_CLIENT_SECRET | lib/oauth-config.ts | **MISSING** — needs placeholder |
| RESEND_API_KEY | Used in failure notifications | **MISSING** — needs real key |
| EMAIL_ROUTING_SECRET | Referenced in code | **MISSING** — needs placeholder |
| NEXT_PUBLIC_APP_URL | Referenced in code | **MISSING** — needs https://fanout.digital |

## Already Present (Correct)
- FACEBOOK_APP_ID, FACEBOOK_APP_SECRET — Production only
- INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET — Production only
- THREADS_APP_ID, THREADS_APP_SECRET — Production only
- FIRECRAWL_API_KEY — Production

## Notes
- Facebook/Instagram/Threads have real values in Production but need Preview/Dev too
- Meta app ID 772426605937002 is pending business verification
- Reddit/Twitter/LinkedIn/TikTok/Pinterest/YouTube need new OAuth apps created
- Square keys needed once Square account is set up
- RESEND_API_KEY needed for failure notification emails
