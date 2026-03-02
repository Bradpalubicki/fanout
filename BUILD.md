# Fanout — Full Build Spec
> **fanout.digital** | Standalone Social Distribution API + Dashboard
> Built by NuStack Digital Ventures

---

## Identity

**Product name:** Fanout
**Domain:** fanout.digital
**Repo:** Bradpalubicki/fanout

**Slogans:**
- "One post. Every platform." ← primary
- "Post once. Reach everywhere."
- "The social API built for agencies."
- "Fan out to the world."
- "Your content, every channel, one call."

**What to tell Claude Code when starting the build:**
> You are building Fanout — a standalone social media distribution API and dashboard
> at fanout.digital. It is a direct Ayrshare competitor. One API call posts content
> to 9 platforms (Twitter/X, LinkedIn, Facebook, Instagram, TikTok, Pinterest, YouTube,
> Reddit, Threads). Multi-tenant via Clerk orgs. OAuth tokens stored encrypted in
> Supabase. Jobs via Inngest. Hosted on Vercel. NuStack stack: Next.js 16, TypeScript
> strict, Tailwind + shadcn/ui. Repo: Bradpalubicki/fanout. See BUILD.md for full spec.

---

## What This Is

A self-hosted Ayrshare replacement AND standalone SaaS product. A single API that:
- Any NuStack engine calls to post content to any social platform on behalf of any client
- Can be sold externally as "The social API built for agencies" ($199–$499/mo)
- Powers the Agency Engine's social media management offering for all clients

**Core value:** One OAuth token store, one post endpoint, unlimited profiles, zero per-post fees.
**Business model:** Internal NuStack infrastructure first → standalone product second.

---

## ROI Calculator

| Scenario | Ayrshare Cost | Our Cost | Monthly Savings |
|---|---|---|---|
| 5 client engines | $2,995/mo | $0 infra | $2,995/mo |
| 10 client engines | $5,990/mo | $0 infra | $5,990/mo |
| Sell to 10 agency clients at $299/mo | — | $2,990/mo revenue | NET NEW |

---

## Layer 0 Analysis

### Why Build This

| | Ayrshare | Social Media Engine |
|---|---|---|
| Cost | $149–$599/mo + add-ons | $0 internal / $299 sold |
| Platforms | 13 | 9 MVP → 13+ roadmap |
| Multi-tenant | Business plan only ($599+) | Built-in via Clerk orgs |
| Token control | Ayrshare holds your tokens | You hold your tokens |
| Custom features | No | Full access to platform APIs |
| White-label | Enterprise only | Default |
| Analytics depth | Aggregated only | Direct from platform |
| AI content | No | Native via content-engine |
| Approval workflow | No | Built-in (generate → approve → post) |
| Vertical-specific | Generic | Healthcare/dental/salon/wellness |

### Positioning (Standalone Product)

**Headline:** "The Social API built for agencies. Post to 9 platforms, unlimited clients, zero per-profile fees."
**Sub:** "One integration. Every platform. Every client. No Ayrshare tax."
**ICP:** Digital agencies managing 5–50 client social accounts

---

## Platform Coverage

### Phase 1 (MVP — Week 1-2)
| Platform | OAuth | Token Expiry | Refresh? | Approval Wait |
|---|---|---|---|---|
| LinkedIn | 2.0 | 2 hours | Yes (perpetual refresh) | None — auto |
| Twitter/X | 2.0 | Configurable | Yes | None — auto |
| Facebook | 2.0 | 60 days | Yes | Business verification |
| Pinterest | 2.0 | 1 year | Yes | 1–3 days |
| YouTube | 2.0 | 1 hour | Yes (perpetual) | Google review |

### Phase 2 (Week 3-4)
| Platform | OAuth | Token Expiry | Refresh? | Approval Wait |
|---|---|---|---|---|
| Instagram | 2.0 (via Meta) | 60 days | Yes | Meta app review 1–7 days |
| TikTok | 2.0 | 30–90 days | Yes | App review 7 business days |
| Reddit | 2.0 | 1 hour | Yes | Commercial use 1–14 days |
| Threads | 2.0 (via Meta) | 60 days | Yes | Meta limited access 2–4 weeks |

### Phase 3 (Post-launch stretch)
| Platform | Notes |
|---|---|
| Bluesky | AT Protocol OAuth 2.0 + DPoP + PKCE + PAR — decentralized PDS, complex but feasible |
| Google Business Profile | `mybusiness.googleapis.com` — requires merchant manual consent |
| Snapchat | Story API only — limited publishing |
| Telegram | Bot API — channel posting |

---

## Platform API Notes

**Twitter/X**
- Use OAuth 2.0 (not 1.0a — that's legacy)
- Scopes: `tweet.write tweet.read users.read offline.access`
- Free tier: 1,500 tweets/month — need Basic ($200/mo) for real usage
- Media: send with tweet payload, no separate upload needed
- Rate limit: 50 requests/15-min window

**LinkedIn**
- Scopes: `w_member_social w_organization_social r_liteprofile`
- 2-step media: register upload → PUT to upload URL → POST share with asset URN
- Rate limit: 100 req/min
- Refresh tokens never expire — best platform for long-term tokens

**Facebook**
- Scopes: `pages_manage_posts pages_show_list manage_pages`
- Page access tokens are permanent if user token is long-lived
- Media: separate `/photos` and `/videos` endpoints
- Rate limit: 10 req/sec (Tier 1)

**Instagram**
- REQUIRES business account linked to Facebook Page
- Scopes: `instagram_business_basic instagram_business_content_publish`
- 2-step: POST to `/{ig-user-id}/media` → POST to `/{ig-user-id}/media_publish`
- Rate limit: 200 req/hour per account
- Meta app review required — plan 1 week lead time

**TikTok**
- Scopes: `video.upload video.publish`
- Chunked upload REQUIRED (5MB–64MB per chunk)
- Rate limit: 6 req/min per user token — must queue carefully
- App review takes 7 business days — apply early

**Pinterest**
- Scopes: `pins:write boards:read`
- Media via URL (no upload needed — just pass image URL)
- 1,000 req/hour rate limit — most generous
- Easiest approval: 1–3 days

**YouTube**
- Scopes: `youtube.upload`
- Chunked resumable upload for videos
- 100,000 quota units/day (video upload = 50 units each)
- Standard Google consent screen review

**Reddit**
- Scopes: `submit read`
- High ban risk — must post authentic, non-spam content
- Commercial use requires documented use case
- Rate limit: 1,000 req/10-min with OAuth

**Threads**
- Scopes: `threads_basic threads_content_publish`
- 2-step: create container → publish
- Currently limited access — apply early via Meta
- 2–4 week approval timeline

**Bluesky (Phase 3)**
- AT Protocol OAuth 2.0 with PKCE + DPoP (per-request cryptographic signing)
- Required scopes: `atproto` (mandatory base scope)
- Client metadata must be published at a public HTTPS URL (used as client_id)
- PDS instance is user-specific (decentralized) — requires DID resolution first
- Implement with `@atproto/oauth-client-node`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENTS                                    │
│  Agency Engine  ·  Content Engine  ·  Dental  ·  MensHealth  ...│
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/v1/post
                           │ Bearer <profile_api_key>
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SOCIAL MEDIA ENGINE                             │
│  social-media-engine.vercel.app / custom domain                  │
│                                                                  │
│  /api/v1/post          → Fan-out orchestrator (Inngest)          │
│  /api/v1/schedule      → Queue for future post                   │
│  /api/v1/profiles      → CRUD client profiles + API keys         │
│  /api/v1/platforms     → OAuth connect/disconnect                │
│  /api/v1/analytics     → Aggregate platform metrics              │
│  /api/v1/ai/generate   → AI content generation (Claude)          │
│  /api/oauth/[platform] → OAuth callback handlers                 │
│  /dashboard            → Management UI                          │
│  /docs                 → API documentation (public)              │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────┐                ┌──────────────────────────────┐
│    Supabase      │                │         Inngest               │
│    PostgreSQL    │                │                              │
│                  │                │  fan-out-post                │
│  profiles        │                │  scheduled-post              │
│  oauth_tokens    │                │  retry-failed-post           │
│  posts           │                │  refresh-tokens (4h cron)    │
│  post_results    │                │  collect-analytics (nightly) │
│  analytics       │                │  ai-generate-post            │
│  post_queue      │                │  approval-notify             │
│  ai_drafts       │                └──────────────────────────────┘
│  audit_log       │
└──────────────────┘
```

---

## Database Schema

### `profiles`
```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL,          -- Clerk org ID
  name            TEXT NOT NULL,          -- "AK Dental Social"
  slug            TEXT NOT NULL UNIQUE,   -- "ak-dental"
  api_key_hash    TEXT,                   -- SHA-256 of API key
  webhook_url     TEXT,                   -- optional post completion webhook
  timezone        TEXT DEFAULT 'UTC',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `oauth_tokens`
```sql
CREATE TABLE oauth_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  access_token     TEXT NOT NULL,         -- pgp_sym_encrypt
  refresh_token    TEXT,                  -- pgp_sym_encrypt
  token_secret     TEXT,                  -- OAuth 1.0a (legacy)
  expires_at       TIMESTAMPTZ,
  scopes           TEXT[],
  platform_user_id TEXT,
  platform_username TEXT,
  platform_page_id TEXT,                  -- Facebook page ID, etc.
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, platform)
);
```

### `posts`
```sql
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES profiles(id),
  content       TEXT NOT NULL,
  platforms     TEXT[] NOT NULL,
  media_urls    TEXT[],
  scheduled_for TIMESTAMPTZ,              -- NULL = post immediately
  status        TEXT DEFAULT 'pending',   -- pending|posting|posted|failed|draft|pending_approval
  source        TEXT DEFAULT 'api',       -- api|dashboard|ai_generated
  ai_draft_id   UUID REFERENCES ai_drafts(id),
  created_by    TEXT,                     -- Clerk user ID
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `post_results`
```sql
CREATE TABLE post_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES posts(id),
  platform          TEXT NOT NULL,
  status            TEXT NOT NULL,        -- success|failed
  platform_post_id  TEXT,
  platform_post_url TEXT,
  error_message     TEXT,
  attempts          INT DEFAULT 0,
  posted_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### `analytics_snapshots`
```sql
CREATE TABLE analytics_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_result_id UUID NOT NULL REFERENCES post_results(id),
  platform       TEXT NOT NULL,
  impressions    INT,
  likes          INT,
  comments       INT,
  shares         INT,
  clicks         INT,
  reach          INT,
  collected_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `ai_drafts`
```sql
CREATE TABLE ai_drafts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id),
  prompt       TEXT NOT NULL,
  generated    TEXT NOT NULL,             -- AI-generated content
  platforms    TEXT[],                    -- target platforms
  status       TEXT DEFAULT 'draft',      -- draft|approved|rejected|posted
  approved_by  TEXT,                      -- Clerk user ID
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `oauth_state`
```sql
CREATE TABLE oauth_state (
  token      TEXT PRIMARY KEY,
  profile_id UUID NOT NULL,
  platform   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `oauth_audit_log`
```sql
CREATE TABLE oauth_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL,
  platform   TEXT NOT NULL,
  action     TEXT NOT NULL,              -- connect|refresh|revoke|read|post
  success    BOOLEAN,
  ip_address INET,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON profiles
  USING (org_id = auth.jwt() ->> 'org_id');

CREATE POLICY "org_token_access" ON oauth_tokens
  USING (profile_id IN (
    SELECT id FROM profiles WHERE org_id = auth.jwt() ->> 'org_id'
  ));

CREATE POLICY "org_post_access" ON posts
  USING (profile_id IN (
    SELECT id FROM profiles WHERE org_id = auth.jwt() ->> 'org_id'
  ));
```

### Token Encryption
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt on write (Server Action only — never client code)
UPDATE oauth_tokens
SET access_token = pgp_sym_encrypt(raw_token, current_setting('app.encryption_key'))
WHERE id = $1;

-- Decrypt on read (Server Action only)
SELECT pgp_sym_decrypt(access_token::bytea, current_setting('app.encryption_key'))
FROM oauth_tokens WHERE id = $1;
```

---

## API Design

### Authentication
All external API calls require an API key header:
```
Authorization: Bearer <profile_api_key>
```
API keys are per-profile, stored hashed (SHA-256) in `profiles.api_key_hash`.
Key generation: `crypto.randomBytes(32).toString('hex')`

### POST /api/v1/post
```json
// Request
{
  "post": "Today is a great day!",
  "platforms": ["twitter", "linkedin", "facebook"],
  "mediaUrls": ["https://example.com/image.jpg"],
  "profileId": "ak-dental"
}

// Response
{
  "status": "success",
  "id": "post_uuid",
  "results": [
    { "platform": "twitter", "status": "success", "postId": "...", "postUrl": "..." },
    { "platform": "linkedin", "status": "success", "postId": "...", "postUrl": "..." },
    { "platform": "facebook", "status": "failed", "error": "Token expired" }
  ]
}
```

### POST /api/v1/schedule
Same body as /post + `scheduledFor: "2026-03-10T14:00:00Z"`.

### POST /api/v1/ai/generate
```json
// Request
{
  "profileId": "ak-dental",
  "prompt": "Promote our teeth whitening special — 20% off in March",
  "platforms": ["twitter", "linkedin", "facebook"],
  "tone": "professional",
  "includeHashtags": true
}

// Response
{
  "draftId": "uuid",
  "content": "...",
  "platformVariants": {
    "twitter": "...",   // ≤280 chars, hashtags
    "linkedin": "...",  // longer, professional tone
    "facebook": "..."   // casual, emoji-friendly
  },
  "status": "pending_approval"
}
```

### POST /api/v1/ai/approve
```json
{ "draftId": "uuid", "scheduleFor": "2026-03-10T14:00:00Z" }
```

### GET /api/v1/platforms
Returns connected platforms + token health for a profile.

### POST /api/v1/platforms/connect
Initiates OAuth flow. Returns `{ redirectUrl: "..." }`.

### DELETE /api/v1/platforms/[platform]
Revokes token and disconnects platform.

### GET /api/v1/analytics/[postId]
Returns aggregated + per-platform metrics.

### POST /api/v1/webhooks/[platform]
Incoming platform events (comment notifications, etc.).

---

## Platform Distributor Pattern

```typescript
// src/distributors/base.ts
export interface PostPayload {
  content: string;
  mediaUrls?: string[];
  platformConfig?: Record<string, unknown>;
}

export interface PostResult {
  success: boolean;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
}

export abstract class BaseDistributor {
  abstract platform: string;
  abstract post(payload: PostPayload, accessToken: string): Promise<PostResult>;
  abstract refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>;
  abstract getAnalytics(platformPostId: string, accessToken: string): Promise<Partial<AnalyticsSnapshot>>;
}
```

```typescript
// src/distributors/linkedin.ts
export class LinkedInDistributor extends BaseDistributor {
  platform = 'linkedin';

  async post(payload: PostPayload, accessToken: string): Promise<PostResult> {
    const mediaAssets = await this.uploadMedia(payload.mediaUrls, accessToken);
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(this.buildSharePayload(payload.content, mediaAssets))
    });
    const data = await res.json();
    return {
      success: res.ok,
      platformPostId: data.id,
      platformPostUrl: `https://www.linkedin.com/feed/update/${data.id}`,
      error: res.ok ? undefined : data.message
    };
  }

  private async uploadMedia(urls: string[] | undefined, token: string) {
    if (!urls?.length) return [];
    // Step 1: Register upload
    // Step 2: PUT binary to upload URL
    // Step 3: Return asset URN
  }

  async refreshToken(refreshToken: string) {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      })
    });
    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    };
  }

  async getAnalytics(platformPostId: string, accessToken: string) {
    // LinkedIn Analytics API
    return {};
  }
}
```

Fan-out orchestrator:
```typescript
// src/lib/fan-out.ts
const DISTRIBUTORS: Record<string, BaseDistributor> = {
  linkedin:  new LinkedInDistributor(),
  twitter:   new TwitterDistributor(),
  facebook:  new FacebookDistributor(),
  instagram: new InstagramDistributor(),
  tiktok:    new TikTokDistributor(),
  pinterest: new PinterestDistributor(),
  youtube:   new YouTubeDistributor(),
  reddit:    new RedditDistributor(),
  threads:   new ThreadsDistributor(),
};

export async function fanOut(postId: string, platforms: string[], profileId: string) {
  const tokens = await getDecryptedTokens(profileId, platforms);
  const post = await getPost(postId);

  const results = await Promise.allSettled(
    platforms.map(platform =>
      DISTRIBUTORS[platform].post(
        { content: post.content, mediaUrls: post.media_urls },
        tokens[platform].accessToken
      )
    )
  );

  await saveResults(postId, platforms, results);

  // Fire webhook if configured
  const profile = await getProfile(profileId);
  if (profile.webhook_url) {
    await fireWebhook(profile.webhook_url, { postId, results });
  }
}
```

---

## AI Content Generation Flow

```
User submits prompt
        ↓
POST /api/v1/ai/generate
        ↓
Claude claude-sonnet-4-6 generates variants per platform
        ↓
Stored in ai_drafts (status=draft)
        ↓
Dashboard shows pending approval queue
        ↓
User approves/edits in dashboard
        ↓
POST /api/v1/ai/approve { draftId, scheduleFor? }
        ↓
Creates post in posts table (status=pending_approval → pending)
        ↓
Inngest scheduled-post job fires at scheduled_for
        ↓
fan-out to platforms
```

AI generation prompt template:
```typescript
const systemPrompt = `You are a social media content expert for ${profile.name}.
Generate platform-optimized posts. Each variant must respect character limits and tone.
- Twitter: ≤280 chars, punchy, 2-3 hashtags
- LinkedIn: 150-300 chars, professional, 3-5 hashtags, no emoji spam
- Facebook: 100-200 chars, conversational, 1-2 emoji, 2-3 hashtags
- Instagram: caption + 20-30 hashtags on new line
Return JSON: { twitter, linkedin, facebook, instagram }`;
```

---

## OAuth Flow

```
User clicks "Connect Twitter"
        ↓
GET /api/oauth/twitter/authorize
  → Generate state token (store in oauth_state with profileId + 10min expiry)
  → Redirect to Twitter OAuth URL with state
        ↓
Twitter redirects to /api/oauth/twitter/callback?code=...&state=...
  → Verify state token exists + not expired
  → Exchange code for access_token + refresh_token
  → pgp_sym_encrypt tokens with TOKEN_ENCRYPTION_KEY
  → Upsert into oauth_tokens
  → Delete used state token
  → Audit log: connect event
  → Redirect to /dashboard/platforms?connected=twitter
```

### OAuth Callback Handler
```typescript
// src/app/api/oauth/[platform]/callback/route.ts
export async function GET(req: Request, { params }: { params: { platform: string } }) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const stateRecord = await verifyOAuthState(state!);
  if (!stateRecord) return redirect('/dashboard/platforms?error=invalid_state');

  const tokens = await exchangeCodeForTokens(params.platform, code!);
  await storeEncryptedTokens(stateRecord.profileId, params.platform, tokens);
  await auditLog(stateRecord.profileId, params.platform, 'connect', true);

  return redirect('/dashboard/platforms?connected=' + params.platform);
}
```

---

## Token Refresh Strategy (Inngest)

```typescript
// src/inngest/functions/refresh-tokens.ts
export const refreshExpiringTokens = inngest.createFunction(
  { id: 'refresh-expiring-tokens' },
  { cron: '0 */4 * * *' }, // Every 4 hours
  async ({ step }) => {
    const expiringTokens = await step.run('find-expiring', async () => {
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('oauth_tokens')
        .select('id, profile_id, platform, refresh_token, expires_at')
        .lt('expires_at', cutoff)
        .not('refresh_token', 'is', null);
      return data ?? [];
    });

    // Fan-out one step per token (Inngest parallelism)
    const events = expiringTokens.map(t => ({
      name: 'social/token.refresh',
      data: { tokenId: t.id, profileId: t.profile_id, platform: t.platform }
    }));
    await step.sendEvent('fan-out-refreshes', events);
  }
);

export const refreshSingleToken = inngest.createFunction(
  { id: 'refresh-single-token' },
  { event: 'social/token.refresh' },
  async ({ event, step }) => {
    await step.run('refresh', async () => {
      const distributor = DISTRIBUTORS[event.data.platform];
      const token = await getEncryptedToken(event.data.tokenId);
      const decryptedRefresh = await decrypt(token.refresh_token);
      const newTokens = await distributor.refreshToken(decryptedRefresh);
      await updateEncryptedToken(event.data.tokenId, newTokens);
      await auditLog(event.data.profileId, event.data.platform, 'refresh', true);
    });
  }
);
```

---

## Media Upload Strategy

```typescript
// src/lib/media-uploader.ts
export async function uploadMediaForPlatform(
  platform: string,
  mediaUrl: string,
  accessToken: string
): Promise<string> {
  switch (platform) {
    case 'instagram':
    case 'threads':
      return uploadToMetaContainer(mediaUrl, accessToken);
    case 'linkedin':
      return uploadToLinkedInAsset(mediaUrl, accessToken);
    case 'tiktok':
      return uploadTikTokChunked(mediaUrl, accessToken);
    case 'youtube':
      return uploadYouTubeResumable(mediaUrl, accessToken);
    case 'twitter':
    case 'facebook':
    case 'pinterest':
    case 'reddit':
      return mediaUrl; // URL pass-through
    default:
      return mediaUrl;
  }
}
```

---

## Rate Limiting (Per-Tenant, Per-Platform)

```typescript
// src/lib/rate-limiter.ts
// Hierarchical rate limits: system → tenant → platform → endpoint
const PLATFORM_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  twitter:   { requests: 50,    windowMs: 15 * 60 * 1000 },
  linkedin:  { requests: 100,   windowMs: 60 * 1000 },
  facebook:  { requests: 10,    windowMs: 1000 },
  instagram: { requests: 200,   windowMs: 60 * 60 * 1000 },
  tiktok:    { requests: 6,     windowMs: 60 * 1000 },
  pinterest: { requests: 1000,  windowMs: 60 * 60 * 1000 },
};

// Use Upstash Redis (or Vercel KV) for distributed rate limit counters
// Key pattern: `ratelimit:${profileId}:${platform}:${windowStart}`
```

---

## Inngest Jobs

```typescript
// 1. fan-out-post — triggered on new post creation
// 2. scheduled-post — triggered at scheduled_for time
// 3. retry-failed — every 30 min, retry failed posts (attempts < 3)
// 4. refresh-tokens — every 4 hours, fan-out per expiring token
// 5. collect-analytics — nightly, pull metrics for posts from last 7 days
// 6. ai-generate — triggered on AI generation request
// 7. approval-notify — notify dashboard/webhook when draft needs approval
// 8. delete-expired-state — hourly, clean oauth_state table
```

---

## Vercel Cron (fallback)

```json
{
  "crons": [
    { "path": "/api/cron/process-queue",    "schedule": "*/5 * * * *" },
    { "path": "/api/cron/refresh-tokens",   "schedule": "0 */4 * * *" },
    { "path": "/api/cron/collect-analytics","schedule": "0 23 * * *" },
    { "path": "/api/cron/cleanup-state",    "schedule": "0 * * * *" }
  ]
}
```

---

## Dashboard Pages

```
/                             → Marketing/landing (public, SEO-optimized)
/pricing                      → Pricing page (public)
/docs                         → API docs (public)

/dashboard                    → Overview: post counts, platform health, recent activity
/dashboard/profiles           → List all client profiles + API key management
/dashboard/profiles/new       → Create new profile
/dashboard/profiles/[id]      → Profile detail: platforms, recent posts, analytics
/dashboard/profiles/[id]/connect → OAuth connect flow per platform
/dashboard/compose            → Manual post composer (multi-platform preview)
/dashboard/schedule           → Scheduled post queue + calendar view
/dashboard/ai                 → AI content generator + approval queue
/dashboard/analytics          → Cross-platform analytics + charts
/dashboard/settings           → Webhooks, API keys, billing
```

---

## Public Landing Page Structure

```
Hero: "Post to 9 platforms. One API. Unlimited clients."
    → Get Started (free trial) + View API Docs

Features grid (6):
  ✓ 9 platforms, one integration
  ✓ AI content generation built-in
  ✓ Unlimited client profiles
  ✓ Scheduled posting with Inngest
  ✓ Token encryption + audit logs
  ✓ Per-profile webhooks

Platform logos row

Pricing (3 tiers):
  Starter — $49/mo — 3 profiles, 5 platforms
  Agency  — $199/mo — 25 profiles, all platforms, AI generation
  White-Label — $399/mo — unlimited, custom domain, API access

Comparison table vs Ayrshare

CTA: "Replace Ayrshare in 15 minutes"
```

---

## Multi-Tenant Integration (Agency Engine)

The Agency Engine calls Social Media Engine on behalf of its clients:

```typescript
// In agency-engine: when onboarding a new client
async function provisionSocialProfile(orgId: string, clientName: string) {
  const slug = clientName.toLowerCase().replace(/\s+/g, '-');

  // Create profile in Social Media Engine
  const res = await fetch(`${process.env.SOCIAL_ENGINE_URL}/api/v1/profiles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SOCIAL_ENGINE_ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orgId, name: clientName, slug })
  });

  const { profile, apiKey } = await res.json();

  // Store in agency-engine DB for this client
  await supabase.from('client_social_config').upsert({
    org_id: orgId,
    social_profile_id: profile.id,
    social_api_key: apiKey, // store encrypted
    social_profile_slug: slug
  });

  return profile;
}
```

---

## Calling Social Media Engine From Any NuStack Engine

```typescript
// Drop-in replacement for Ayrshare
async function postToSocial(content: string, platforms: string[], mediaUrls?: string[]) {
  const res = await fetch(`${process.env.SOCIAL_ENGINE_URL}/api/v1/post`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SOCIAL_ENGINE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post: content,
      platforms,
      mediaUrls,
      profileId: process.env.SOCIAL_ENGINE_PROFILE_ID,
    }),
  });
  return res.json();
}

// Env vars needed in each engine:
// SOCIAL_ENGINE_URL=https://social.nustack.digital
// SOCIAL_ENGINE_API_KEY=<per-profile key>
// SOCIAL_ENGINE_PROFILE_ID=<profile slug>
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Encryption
TOKEN_ENCRYPTION_KEY=        # openssl rand -hex 32

# AI Generation
ANTHROPIC_API_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Internal API
SOCIAL_ENGINE_SECRET=        # for engine-to-engine calls (not user-facing)
SOCIAL_ENGINE_ADMIN_KEY=     # for agency-engine provisioning

# Platform OAuth Credentials
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
PINTEREST_CALLBACK_URL=

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_CALLBACK_URL=

TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_CALLBACK_URL=

REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_CALLBACK_URL=

THREADS_APP_ID=
THREADS_APP_SECRET=

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Optional: Upstash Redis for rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Platform App Registrations

Apply NOW — approvals are the only blocker:

| Priority | Platform | Where to Register | Wait | Notes |
|---|---|---|---|---|
| 🔴 Apply NOW | Threads | Meta App Dashboard | 2–4 weeks | Longest wait |
| 🔴 Apply NOW | TikTok | developers.tiktok.com | 7 business days | |
| 🔴 Apply NOW | Instagram | Meta App Dashboard | 1–7 days | Share app with Facebook |
| 🟡 Apply soon | Reddit | reddit.com/prefs/apps | 1–14 days | Document commercial use |
| 🟡 Apply soon | Facebook | Meta App Dashboard | Business verification | Share with Instagram app |
| 🟢 Instant | Twitter/X | developer.twitter.com | Same day | Auto-approved |
| 🟢 Instant | LinkedIn | linkedin.com/developers | Same day | Auto-approved |
| 🟢 Fast | Pinterest | developers.pinterest.com | 1–3 days | |
| 🟢 Fast | YouTube | console.cloud.google.com | 1–7 days | Google consent screen |

---

## Phased Build Order

### Phase 1 — Core Infrastructure (Week 1)
- [ ] `npx create-next-app@latest social-media-engine` with NuStack stack
- [ ] Supabase project (new) + all migrations + pgcrypto
- [ ] Clerk auth setup
- [ ] Token encryption utilities (`src/lib/crypto.ts`)
- [ ] Base distributor abstract class
- [ ] LinkedIn + Twitter distributors (easiest platforms)
- [ ] `/api/v1/post` fan-out endpoint
- [ ] OAuth flow: LinkedIn + Twitter (authorize + callback routes)
- [ ] Dashboard: profiles list + platform connect UI
- [ ] Inngest setup: fan-out-post + retry-failed jobs
- [ ] Public landing page (hero + pricing + features)
- [ ] Deploy to Vercel

### Phase 2 — Expand + Schedule (Week 2)
- [ ] Facebook + Pinterest distributors
- [ ] YouTube distributor (resumable upload)
- [ ] Token refresh Inngest job
- [ ] `/api/v1/schedule` + scheduled-post Inngest job
- [ ] Dashboard: compose + schedule UI
- [ ] Per-profile API key generation UI
- [ ] Wire content-engine to use Social Media Engine (replace Ayrshare)

### Phase 3 — AI + Analytics + Agency Integration (Week 3)
- [ ] AI content generation: `/api/v1/ai/generate` + Claude integration
- [ ] Approval queue dashboard
- [ ] Analytics collector (Inngest nightly)
- [ ] `/api/v1/analytics` endpoint + dashboard charts (Recharts)
- [ ] Agency Engine provisioning API (`POST /api/v1/profiles` admin route)
- [ ] Rate limiting middleware (per-tenant, per-platform)
- [ ] Public API docs page

### Phase 4 — Remaining Platforms + Polish (as approvals arrive)
- [ ] Instagram distributor (Media Graph API 2-step)
- [ ] TikTok distributor (chunked upload)
- [ ] Reddit distributor
- [ ] Threads distributor
- [ ] Bluesky (Phase 3 stretch — AT Protocol OAuth)
- [ ] Pricing page + Stripe/Square billing for standalone product
- [ ] White-label support (custom domain per client)

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | NuStack standard |
| Database | Supabase + pgcrypto | Token encryption + RLS |
| Auth | Clerk | NuStack standard, org multi-tenancy |
| Jobs | Inngest | Reliable fan-out, retries, cron |
| Hosting | Vercel | NuStack standard |
| Styling | Tailwind + shadcn/ui | NuStack standard |
| Language | TypeScript strict | No `any` types |
| Analytics | PostHog | LLM analytics, zero cost |
| Monitoring | Sentry | Error tracking |
| Rate Limiting | Upstash Redis (optional) | Distributed counters |
| AI | Anthropic claude-sonnet-4-6 | Content generation |

---

## Competitive Moat

Once built, this becomes permanent NuStack infrastructure:

1. **Every engine** replaces Ayrshare with one env var swap — `$0/mo` forever
2. **Agency Engine** offers social management as a managed service
3. **Standalone SaaS** — sell to agencies at $199–$399/mo
4. **Multi-tenant by design** — Clerk org isolation, pgcrypto token encryption
5. **AI-native** — generate → approve → post flow no competitor offers at this price
6. **Vertical-aware** — content templates for healthcare/dental/wellness/service verticals
7. **Direct platform API** — not rate-limited or restricted by Ayrshare's abstraction

Ayrshare Business Plan: $599/mo for 30 profiles.
We replace it at $0 internally and monetize it externally.
