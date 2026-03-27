# Social Account Setup — NuStack Products

This is Brad's manual checklist for creating the actual platform accounts.
The posting agent is built and ready. These accounts need to exist before it can post.

**Rule:** Create the account → connect it in Fanout dashboard → run the SQL to activate it.

---

## CertusAudit — ADA Compliance Scanner

**Active platforms:** Twitter/X, LinkedIn

### Twitter/X
- **Create at:** x.com → Sign up
- **Email:** certusaudit@nustack.digital
- **Handle:** @CertusAudit
- **Display name:** CertusAudit
- **Bio:** ADA Title II compliance scanner for government entities. Free site scan. certusaudit.co
- **Website:** https://certusaudit.co
- **Profile photo:** CertusAudit logo (navy + gold)
- **After creating:**
  1. Go to fanout.digital/dashboard → Profiles → CertusAudit → Connect Twitter
  2. Complete OAuth flow
  3. Run in Supabase: `UPDATE product_platform_accounts SET status = 'active' WHERE product = 'certusaudit' AND platform = 'twitter';`

### LinkedIn Company Page
- **Create at:** linkedin.com/company/setup/new
- **Email:** certusaudit@nustack.digital (or brad@nustack.digital)
- **Company name:** CertusAudit
- **URL:** linkedin.com/company/certusaudit
- **Tagline:** ADA compliance scanning for government websites
- **Industry:** Government Administration / Software
- **Company size:** 2-10 employees
- **Website:** https://certusaudit.co
- **After creating:**
  1. Go to fanout.digital/dashboard → Profiles → CertusAudit → Connect LinkedIn
  2. Complete OAuth flow (requires w_member_social permission — may need 24-48hr approval)
  3. Run: `UPDATE product_platform_accounts SET status = 'active' WHERE product = 'certusaudit' AND platform = 'linkedin';`

---

## PocketPals — Kids AI Companion App

**Active platforms:** Twitter/X, Instagram, TikTok (Instagram and TikTok blocked until Meta/TikTok apps approved)

### Twitter/X
- **Email:** pocketpals@nustack.digital
- **Handle:** @PocketPalsApp
- **Display name:** PocketPals
- **Bio:** Meet Buddy — the AI companion that grows with your child. Safe. Fun. For ages 3-12. 🐾 pocketpals.app
- **Website:** https://pocketpals.app
- **After creating:** Same OAuth flow as above, then: `UPDATE product_platform_accounts SET status = 'active' WHERE product = 'pocketpals' AND platform = 'twitter';`

### Instagram
- **BLOCKED until:** Meta Business Verification approved (App ID: 772426605937002)
- **Email:** pocketpals@nustack.digital
- **Handle:** @pocketpalsapp
- **Bio:** Buddy is your child's new favorite companion 🐾 Safe AI for ages 3-12. Download ↓
- **Account type:** Creator or Business
- **After Meta approves:** Connect via Fanout OAuth, then activate in DB

### TikTok
- **BLOCKED until:** TikTok app review approved (1-2 weeks)
- **Handle:** @pocketpals
- **Bio:** AI companion for kids 🐾 Parents love it. Kids can't put it down.
- **After TikTok approves:** Connect via Fanout OAuth, then activate in DB

---

## SiteGrade — Website Grader

**Active platforms:** Twitter/X, LinkedIn

### Twitter/X
- **Email:** sitegrade@nustack.digital
- **Handle:** @SiteGradeApp
- **Display name:** SiteGrade
- **Bio:** Your website is leaking customers. SiteGrade shows you exactly where. Free grade at sitegrade.co
- **Website:** https://sitegrade.co
- **After creating:** OAuth flow + `UPDATE product_platform_accounts SET status = 'active' WHERE product = 'sitegrade' AND platform = 'twitter';`

### LinkedIn Company Page
- **Company name:** SiteGrade
- **URL:** linkedin.com/company/sitegrade
- **Tagline:** Website performance grader for local businesses
- **Industry:** Software
- **Website:** https://sitegrade.co
- **After creating:** OAuth flow + `UPDATE product_platform_accounts SET status = 'active' WHERE product = 'sitegrade' AND platform = 'linkedin';`

---

## Wellness Engine — Clinic Operations Platform

**Active platforms:** Twitter/X, LinkedIn

**⚠️ ACTIVATION GATE:** Do NOT activate posting until `SQUARE_ENVIRONMENT=production` is confirmed in Vercel.

### Twitter/X
- **Email:** wellness@nustack.digital
- **Handle:** @WellnessEngine
- **Display name:** Wellness Engine
- **Bio:** All-in-one platform for wellness clinics. Scheduling, billing, intake, and more. wellnessengine.io
- **Website:** https://wellnessengine.io
- **After Square is confirmed production:** OAuth flow + `UPDATE product_platform_accounts SET status = 'active' WHERE product = 'wellness-engine' AND platform = 'twitter';`

### LinkedIn Company Page
- **Company name:** Wellness Engine
- **Tagline:** Practice management platform for wellness clinics
- **Industry:** Health, Wellness & Fitness / Software
- **Website:** https://wellnessengine.io
- **After Square is confirmed production:** OAuth flow + activate in DB

---

## What's Blocked (Brad can't fix, waiting on platform approvals)

| Platform | Blocked By | ETA | Check At |
|---|---|---|---|
| Instagram | Meta Business Verification | Unknown | developers.facebook.com/apps/772426605937002 |
| Facebook | Same Meta verification | Unknown | Same |
| Threads | Same Meta verification | Unknown | Same |
| TikTok | TikTok app review | 1-2 weeks | developers.tiktok.com |
| Pinterest | Pinterest app review | 1-2 weeks | developers.pinterest.com |
| YouTube | Google verification (optional) | Immediate (test mode) | console.cloud.google.com |

## What Brad Needs To Register (OAuth apps — ~2 hrs total)

### Reddit (30 min — instant approval)
1. Go to reddit.com/prefs/apps (logged in as brad@nustack.digital)
2. Create web app: `Fanout - Social Distribution`
3. Redirect URI: `https://fanout.digital/api/oauth/reddit/callback`
4. Copy Client ID and Secret
5. Add to Vercel: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`

### Twitter/X Developer App (45 min)
1. developer.twitter.com → Create app
2. Permissions: Read and Write
3. Callback: `https://fanout.digital/api/oauth/twitter/callback`
4. Add to Vercel: `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
5. ⚠️ Current env vars are Development-only — promote to Production in Vercel

### LinkedIn App (45 min + 24-48hr review)
1. linkedin.com/developers/apps/new
2. Request "Share on LinkedIn" product
3. Callback: `https://fanout.digital/api/oauth/linkedin/callback`
4. Add to Vercel: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
5. ⚠️ Current env vars are Development-only — promote to Production in Vercel

### YouTube / Google Cloud (45 min)
1. console.cloud.google.com → New project: `Fanout Social API`
2. Enable YouTube Data API v3
3. Create OAuth client → Web app
4. Callback: `https://fanout.digital/api/oauth/youtube/callback`
5. Add to Vercel: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`

---

## After Each Account Is Connected

The posting agent reads from `product_platform_accounts`.
After connecting via Fanout dashboard OAuth, run this to activate:

```sql
-- Example: activate CertusAudit on Twitter
UPDATE product_platform_accounts
SET status = 'active', account_handle = '@CertusAudit'
WHERE product = 'certusaudit' AND platform = 'twitter';
```

Then verify it shows in the Social tab at: fanout.digital/dashboard/social

---

## Content Queue Fills Automatically

Once accounts are active, the content generator runs on demand:

```bash
# Generate and queue a post for CertusAudit on Twitter
curl -X POST https://fanout.digital/api/generate-social-content \
  -H "Authorization: Bearer $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"product": "certusaudit", "platform": "twitter", "queue": true}'
```

The posting agent fires every 6 hours (0 */6 * * *) and picks up all pending posts.
