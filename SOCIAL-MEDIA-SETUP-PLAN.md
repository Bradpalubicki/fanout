# NuStack Social Media Account Setup Plan
Last updated: 2026-03-05

## BRANDS TO SET UP

| Brand | Domain | Primary Purpose |
|-------|--------|-----------------|
| NuStack Digital Ventures | nustack.digital | Agency brand / lead gen |
| Fanout | fanout.digital | SaaS product |
| CourtCase Search | courtcase-search.com | Legal AI SaaS |
| AK Ultimate Dental | akultimatedental.com | Client — dental |
| Men's Health & Wellness | menshealth-engine | Client — healthcare |
| MindStar Counseling | mindstarcounseling.org | Client — mental health |
| Little Roots | littleroots.studio | Client — salon |
| Equipment Rental Engine | (domain TBD) | Client — equipment |

---

## FANOUT OAUTH APP STATUS (platform apps for the API itself)

Fanout needs ONE developer app per platform to power all client connections.
These are registered under brad@nustack.digital dev accounts.

### ✅ ALREADY STARTED
| Platform | App ID / Status | Next Step |
|----------|----------------|-----------|
| Meta (Facebook/Instagram/Threads) | App ID: 772426605937002 | Business Verification in review — wait |

### ⚡ CAN AUTOMATE (Playwright-assisted — do these first)
| Platform | Effort | Status | Notes |
|----------|--------|--------|-------|
| Reddit | Low | PENDING | Instant approval, no review |
| Twitter/X | Medium | PENDING | Dev account + TOTP needed |
| LinkedIn | Medium | PENDING | App review for w_member_social |
| YouTube | Medium | PENDING | Google Cloud Console, enable YouTube Data API v3 |

### ✋ MANUAL ONLY (requires human steps — do these after)
| Platform | Blocker | ETA After Starting |
|----------|---------|-------------------|
| TikTok | Business account + app review | 1–2 weeks |
| Pinterest | App review for write permissions | 1–2 weeks |
| Facebook/Instagram | Meta Business Verification (in review) | Waiting |
| Threads | Shares Meta app | Same as Meta |

---

## PHASE 1 — AUTOMATABLE PLATFORMS (Do now, ~2 hours total)

### REDDIT — 30 minutes
**What to do:**
1. Go to https://www.reddit.com/prefs/apps — logged in as brad@nustack.digital
2. Click "create another app"
3. Name: `Fanout - Social Distribution`
4. Type: `web app`
5. Redirect URI: `https://fanout.digital/api/oauth/reddit/callback`
6. Description: "Social media distribution API for agencies"
7. Copy Client ID (under app name) and Secret
8. Add to Vercel env vars: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
9. Set `REDDIT_CALLBACK_URL=https://fanout.digital/api/oauth/reddit/callback`
10. Go to https://fanout.digital/dashboard/admin/oauth-apps → Enter the credentials

**No review needed. Instant.**

---

### TWITTER/X — 45 minutes
**What to do:**
1. Go to https://developer.twitter.com/en/portal/apps/new
2. Apply for a developer account if not already (brad@nustack.digital)
   - Use case: "Building a social media scheduling API for agencies"
   - Will post on behalf of users who authorize via OAuth
3. Create new app: `Fanout`
4. Set App Permissions: `Read and Write`
5. Set Type: `Web App, Automated App or Bot`
6. Add callback URL: `https://fanout.digital/api/oauth/twitter/callback`
7. Copy: `Client ID`, `Client Secret`
8. Add to Vercel: `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
9. Set `TWITTER_CALLBACK_URL=https://fanout.digital/api/oauth/twitter/callback`

**Note:** Twitter requires PKCE flow (already implemented in Fanout's oauth-config.ts)

---

### LINKEDIN — 45 minutes
**What to do:**
1. Go to https://www.linkedin.com/developers/apps/new (logged in as brad@nustack.digital)
2. Create app:
   - App Name: `Fanout`
   - LinkedIn Page: use NuStack Digital Ventures LinkedIn page (create first if needed)
   - App Logo: upload /public/fanout-logo.svg
3. Under "Products" tab → Request access to:
   - **"Share on LinkedIn"** (w_member_social scope) — click Request
   - **"Sign In with LinkedIn using OpenID Connect"** (openid, profile, email)
4. Under "Auth" tab:
   - Add redirect URL: `https://fanout.digital/api/oauth/linkedin/callback`
   - Copy Client ID and Client Secret
5. Add to Vercel: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
6. Set `LINKEDIN_CALLBACK_URL=https://fanout.digital/api/oauth/linkedin/callback`
7. Wait for "Share on LinkedIn" product approval (usually 24-48 hours)

---

### YOUTUBE/GOOGLE — 45 minutes
**What to do:**
1. Go to https://console.cloud.google.com/ (brad@nustack.digital Google account)
2. Create new project: `Fanout Social API`
3. Enable APIs:
   - YouTube Data API v3 (search "YouTube Data" → Enable)
4. Go to APIs & Services → Credentials
5. Click "Create Credentials" → "OAuth client ID"
6. Application type: `Web application`
7. Name: `Fanout`
8. Add authorized redirect URI: `https://fanout.digital/api/oauth/youtube/callback`
9. Download JSON → copy Client ID and Client Secret
10. Go to APIs & Services → OAuth consent screen:
    - User type: External
    - App name: Fanout
    - User support email: brad@nustack.digital
    - Add scopes: youtube.upload, youtube (read from oauth-config.ts)
    - Add test users (for sandbox — add your own Google accounts)
    - Submit for verification (or use in test mode first)
11. Add to Vercel: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
12. Set `YOUTUBE_CALLBACK_URL=https://fanout.digital/api/oauth/youtube/callback`

**Note:** YouTube in test mode works for up to 100 users. For production, submit for Google verification (~1 week).

---

## PHASE 2 — MANUAL PLATFORMS (After Meta Business Verification Approves)

### META (Facebook + Instagram + Threads) — 1 hour
**Current status:** App ID 772426605937002, Business Verification in review
**When approved:**
1. Go to developers.facebook.com/apps/772426605937002
2. Add Products: "Facebook Login" + "Instagram Graph API"
3. Add to Facebook Login Settings:
   - Redirect URI: `https://fanout.digital/api/oauth/facebook/callback`
4. Add to Instagram:
   - Redirect URI: `https://fanout.digital/api/oauth/facebook/callback` (same — shares with Instagram)
5. Request these permissions for App Review:
   - `pages_manage_posts` — post to Facebook Pages
   - `pages_show_list` — list user's pages
   - `instagram_content_publish` — post to Instagram
   - `instagram_basic` — read Instagram info
6. Submit for App Review with test videos/screenshots
7. App Secret is in Settings → Basic (add to Vercel as `FACEBOOK_APP_SECRET`)
8. Add to Vercel: `FACEBOOK_APP_ID=772426605937002`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL`

**Threads** automatically uses the same Meta app — add `threads_content_publish` scope.

---

### TIKTOK — 1-2 weeks to approve
**What to do:**
1. Create a TikTok Business Account at business.tiktok.com (brad@nustack.digital)
2. Go to https://developers.tiktok.com/apps/
3. Create app: `Fanout`
4. Select platform: `Web`
5. Add redirect URI: `https://fanout.digital/api/oauth/tiktok/callback`
6. Request scopes: `video.upload`, `video.publish`, `user.info.basic`
7. Submit for review — describe use case (agency social distribution)
8. Copy Client Key and Client Secret when approved
9. Add to Vercel: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

---

### PINTEREST — 1-2 weeks to approve
**What to do:**
1. Go to https://developers.pinterest.com/apps/
2. Create app: `Fanout`
3. Add redirect URI: `https://fanout.digital/api/oauth/pinterest/callback`
4. Request scopes: `pins:write`, `boards:read`, `user_accounts:read`
5. Submit for review
6. Copy App ID and Secret when approved
7. Add to Vercel: `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`

---

## PHASE 3 — SOCIAL ACCOUNTS PER BRAND

Once Fanout platform apps are live, create profiles in Fanout dashboard and connect them.
These are the SOCIAL MEDIA ACCOUNTS (the actual Twitter/LinkedIn/Instagram accounts for each brand).

### NuStack Digital Ventures — nustack.digital

**Twitter/X:** @NuStackDigital
- Bio: "Done-for-you automation engines for healthcare practices & service businesses. Built by Brad Palubicki."
- Website: nustack.digital
- Profile pic: NuStack logo
- **Create at:** x.com → Sign up with brad@nustack.digital

**LinkedIn Company Page:**
- Name: NuStack Digital Ventures
- URL: linkedin.com/company/nustack-digital
- Tagline: "Built for clinicians who became business owners by accident."
- **Create at:** linkedin.com/company/setup/new

**Instagram:** @nustack.digital
- Bio: "Done-for-you automation engines. No DIY. No config. Just running."
- **Create at:** instagram.com → Business account

**Facebook Page:**
- Name: NuStack Digital Ventures
- Category: Software Company
- **Create at:** facebook.com/pages/create

**YouTube:**
- Channel: NuStack Digital Ventures
- Description: How-it-works videos, client results, product demos
- **Create at:** youtube.com → Create channel with brad@nustack.digital

**Reddit:** u/NuStackDigital
- Subreddits to post in: r/entrepreneur, r/SaaS, r/smallbusiness, r/healthIT
- **Create at:** reddit.com/register

---

### Fanout — fanout.digital

**Twitter/X:** @FanoutAPI
- Bio: "Post to 9 social platforms with one API call. Multi-tenant. AI-powered. White-label. From $49/mo."
- Website: fanout.digital

**LinkedIn Company Page:**
- Name: Fanout
- Tagline: "Stop rebuilding social integrations."

**Reddit:** u/FanoutAPI
- Subreddits: r/SaaS, r/webdev, r/programming, r/node, r/javascript

**Note:** Fanout being on social with its OWN Fanout profiles is the best demo. Self-referential proof.

---

### CourtCase Search — courtcase-search.com

**Twitter/X:** @CourtCaseSearch
- Bio: "AI-powered court case research. Find any case, any court, any jurisdiction. Built by NuStack."
- Website: courtcase-search.com

**LinkedIn:** Company page
- Name: CourtCase Search
- Category: Legal Technology

**Reddit:** u/CourtCaseSearch
- Subreddits: r/law, r/legaladvice (lurk/answer questions), r/lawyers

---

### AK Ultimate Dental — akultimatedental.com

**Instagram:** @akultimatedental
- Bio: "Creating beautiful smiles in [city]. Cosmetic & restorative dentistry. Book online."
- **Content:** Before/afters, team photos, patient tips, seasonal offers

**Facebook Page:** AK Ultimate Dental
- Category: Dentist

**Twitter/X:** @AKUltimateDental (optional — low value for dental)

---

### Men's Health & Wellness Center — menshealth-engine

**Instagram:** @menshealth_wc (or branded name)
- Bio: "Men's health clinic. Testosterone, weight loss, performance. Illinois."

**Facebook Page:** Men's Health & Wellness Center
- Category: Health/Medical

**Twitter/X:** @MensHealthWC

**YouTube:** Men's Health & Wellness Center
- Content: Educational videos on men's health topics (TRT, weight loss, labs)

---

### MindStar Counseling — mindstarcounseling.org

**Instagram:** @mindstarcounseling
- Bio: "Counseling & mental wellness. Dr. Starlette Patterson. Accepting new clients."
- **HIPAA note:** No patient info, no session content — general wellness tips only

**Facebook Page:** MindStar Counseling
- Category: Mental Health Service

**LinkedIn:** MindStar Counseling (professional credibility)

---

### Little Roots — littleroots.studio

**Instagram:** @littleroots.studio ← MOST IMPORTANT for salons
- Bio: "Color specialist. Haircuts. Balayage. Book your consult."
- Content: Before/after transformations, color formulas (blurred), product recs

**Facebook:** Little Roots
- Book Now button → littleroots.studio booking

**Pinterest:** Little Roots
- Boards: Hair Color Inspiration, Balayage, Short Cuts, Salon Tips

**TikTok:** @littleroots
- Content: Time-lapse color transformations, before/after reveals

---

## AUTOMATION SETUP — FANOUT DASHBOARD

Once platform apps are registered and social accounts created:

1. Log into fanout.digital/dashboard
2. Create a Profile for each brand:
   - NuStack Digital Ventures
   - Fanout
   - CourtCase Search
   - AK Ultimate Dental
   - Men's Health & Wellness Center
   - MindStar Counseling
   - Little Roots
3. For each profile → Connect Platforms (OAuth flow)
4. Each profile gets its own API key
5. Content can be posted via dashboard Compose or API

---

## CONTENT STRATEGY — WHAT TO POST

### NuStack Digital Ventures
- Engine launch announcements
- Client wins (with permission)
- Industry stats on healthcare admin burden
- Behind-the-scenes builds
- Frequency: 3x/week Twitter, 2x/week LinkedIn

### Fanout
- Developer tips (curl examples, API patterns)
- Platform changelogs that affect integrations
- "We just added X platform" announcements
- Blog post promotion
- Frequency: daily Twitter, 3x/week

### Client brands (dental, health, salon)
- Specials and promotions
- Educational content (teeth whitening tips, hormone health, hair care)
- Seasonal campaigns
- AI-generated via Fanout AI Drafts
- Frequency: 3x/week per platform

---

## PRIORITY ORDER (Do This Week)

```
Day 1 (1 hour):
[ ] Reddit app — 30 min, instant
[ ] Twitter developer app — 30 min

Day 2 (1.5 hours):
[ ] LinkedIn app + request Share on LinkedIn
[ ] YouTube/Google Cloud Console + enable YouTube Data API

Day 3 (3 hours):
[ ] Create all social ACCOUNTS for NuStack + Fanout
[ ] Create all social ACCOUNTS for CourtCase Search
[ ] Connect NuStack + Fanout accounts via Fanout dashboard

Week 2:
[ ] Wait for Meta Business Verification
[ ] Create client brand accounts (AK Dental, MensHealth, MindStar, Little Roots)
[ ] Connect client accounts to Fanout profiles

Ongoing:
[ ] TikTok app review
[ ] Pinterest app review
[ ] YouTube production verification
```

---

## ENV VARS CHECKLIST (Add to Vercel as each platform activates)

```bash
# Reddit (Day 1)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_CALLBACK_URL=https://fanout.digital/api/oauth/reddit/callback

# Twitter (Day 1)
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=https://fanout.digital/api/oauth/twitter/callback

# LinkedIn (Day 2)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=https://fanout.digital/api/oauth/linkedin/callback

# YouTube (Day 2)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_CALLBACK_URL=https://fanout.digital/api/oauth/youtube/callback

# Meta / Facebook / Instagram / Threads (When Meta approves)
FACEBOOK_APP_ID=772426605937002
FACEBOOK_APP_SECRET=  # from Meta dashboard Settings > Basic
FACEBOOK_CALLBACK_URL=https://fanout.digital/api/oauth/facebook/callback

# TikTok (After review)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_CALLBACK_URL=https://fanout.digital/api/oauth/tiktok/callback

# Pinterest (After review)
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
PINTEREST_CALLBACK_URL=https://fanout.digital/api/oauth/pinterest/callback
```

---

## USERNAMES TO REGISTER (Grab these now before someone else takes them)

Go to each platform and register these while you have momentum:

| Handle | Platform | Brand |
|--------|----------|-------|
| @NuStackDigital | Twitter/X, Instagram | NuStack |
| @FanoutAPI | Twitter/X | Fanout |
| @FanoutApp | Instagram | Fanout |
| @CourtCaseSearch | Twitter/X, Instagram | CourtCase |
| @akultimatedental | Instagram, Twitter | AK Dental |
| @littleroots.studio | Instagram | Little Roots |
| @mindstarcounseling | Instagram | MindStar |
| NuStack Digital Ventures | LinkedIn Company | NuStack |
| Fanout | LinkedIn Company | Fanout |
| CourtCase Search | LinkedIn Company | CourtCase |

**Register these usernames TODAY before this plan does anything else — they go fast.**
