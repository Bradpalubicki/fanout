# Reddit OAuth App — Manual Setup Guide

## Status
Reddit OAuth credentials are not yet configured. Follow these steps to set them up.

## Step 1: Create a Reddit Developer Account

1. Go to https://www.reddit.com and sign in (or create an account)
2. Navigate to https://www.reddit.com/prefs/apps
3. Scroll to the bottom and click **"create another app..."**

## Step 2: Fill in App Details

Use EXACTLY these values:

| Field | Value |
|-------|-------|
| Name | Fanout |
| Type | **web app** (select this radio button) |
| Description | Social media management platform |
| About URL | https://fanout.digital |
| Redirect URI | `https://fanout.digital/api/oauth/reddit/callback` |

Click **"create app"**

## Step 3: Copy Your Credentials

After creation, you'll see:
- **Client ID** — shown under the app name (short string like `abc123def456`)
- **Client Secret** — click "edit" to reveal it

## Step 4: Save Credentials to Vercel

Run these commands in the Social-Media-Engine project:

```bash
# Production
echo "YOUR_CLIENT_ID" | vercel env add REDDIT_CLIENT_ID production --force
echo "YOUR_CLIENT_SECRET" | vercel env add REDDIT_CLIENT_SECRET production --force

# Preview
echo "YOUR_CLIENT_ID" | vercel env add REDDIT_CLIENT_ID preview --force
echo "YOUR_CLIENT_SECRET" | vercel env add REDDIT_CLIENT_SECRET preview --force

# Development
echo "YOUR_CLIENT_ID" | vercel env add REDDIT_CLIENT_ID development --force
echo "YOUR_CLIENT_SECRET" | vercel env add REDDIT_CLIENT_SECRET development --force
```

Also update `.env.local` for local development:
```
REDDIT_CLIENT_ID=YOUR_CLIENT_ID
REDDIT_CLIENT_SECRET=YOUR_CLIENT_SECRET
REDDIT_CALLBACK_URL=https://fanout.digital/api/oauth/reddit/callback
```

## Step 5: Verify Configuration

After setting credentials, test the OAuth flow:

```bash
curl -H "Authorization: Bearer YOUR_PROFILE_API_KEY" \
  https://fanout.digital/api/v1/platforms/status
```

The response should show `"configured": true` for Reddit.

## Notes
- Reddit's free tier allows up to 60 requests/minute per OAuth app
- The `permanent` duration scope is already set in oauth-config.ts (allows refresh tokens)
- Required scopes: `submit`, `read`, `identity` — already configured

## Bootstrap Session (optional)
If you need a Playwright session for Reddit automation:
```bash
npx tsx scripts/bootstrap-session.ts --platform reddit
```
This will open a browser window for you to manually authenticate.
