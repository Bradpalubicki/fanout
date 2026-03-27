// Integration status checker for NuStack product social accounts
// Checks env vars and attempts a read call to verify each platform

export type IntegrationStatus = 'WORKING' | 'TOKEN_EXPIRED' | 'BROKEN' | 'NEVER_SETUP'

export interface IntegrationCheck {
  platform: string
  status: IntegrationStatus
  rootCause: string
  fixTime: string
  envVarsPresent: boolean
  note?: string
}

// Check which env vars are present (as set in Vercel production)
function hasEnvVars(keys: string[]): boolean {
  return keys.every((k) => {
    const v = process.env[k]
    return v && v.trim() !== '' && v !== 'placeholder'
  })
}

export function getIntegrationAudit(): IntegrationCheck[] {
  const checks: IntegrationCheck[] = [
    {
      platform: 'twitter',
      envVarsPresent: hasEnvVars(['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET']),
      status: hasEnvVars(['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET']) ? 'BROKEN' : 'NEVER_SETUP',
      rootCause: hasEnvVars(['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'])
        ? 'OAuth app exists but no user has connected a Twitter account via OAuth flow'
        : 'Twitter Developer App not registered — no OAuth credentials in production',
      fixTime: '45 min — register Twitter dev app, add env vars, OAuth connect each product account',
    },
    {
      platform: 'linkedin',
      envVarsPresent: hasEnvVars(['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']),
      status: hasEnvVars(['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET']) ? 'BROKEN' : 'NEVER_SETUP',
      rootCause: hasEnvVars(['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'])
        ? 'OAuth app exists but w_member_social permission may be pending review'
        : 'LinkedIn OAuth app not registered',
      fixTime: '45 min + 24-48hr review for w_member_social permission',
    },
    {
      platform: 'instagram',
      envVarsPresent: hasEnvVars(['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']),
      status: 'BROKEN',
      rootCause: 'Meta Business Verification pending review (App ID: 772426605937002). Cannot post until verified.',
      fixTime: 'Waiting on Meta — ETA unknown. Check developers.facebook.com for verification status.',
    },
    {
      platform: 'facebook',
      envVarsPresent: hasEnvVars(['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']),
      status: 'BROKEN',
      rootCause: 'Meta Business Verification pending. Same blocker as Instagram.',
      fixTime: 'Waiting on Meta verification — same as Instagram',
    },
    {
      platform: 'threads',
      envVarsPresent: hasEnvVars(['THREADS_APP_ID', 'THREADS_APP_SECRET']),
      status: 'BROKEN',
      rootCause: 'Threads shares the Meta app — blocked by same Business Verification.',
      fixTime: 'Waiting on Meta verification',
    },
    {
      platform: 'tiktok',
      envVarsPresent: hasEnvVars(['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']),
      status: hasEnvVars(['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']) ? 'BROKEN' : 'NEVER_SETUP',
      rootCause: 'TikTok app review required. Requires Business account + 1-2 week review process.',
      fixTime: '1-2 weeks — submit TikTok app for review at developers.tiktok.com',
    },
    {
      platform: 'youtube',
      envVarsPresent: hasEnvVars(['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']),
      status: hasEnvVars(['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']) ? 'BROKEN' : 'NEVER_SETUP',
      rootCause: 'Google Cloud Console OAuth app not registered or YouTube Data API v3 not enabled.',
      fixTime: '45 min setup + up to 1 week for Google verification for production use',
    },
    {
      platform: 'pinterest',
      envVarsPresent: hasEnvVars(['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET']),
      status: hasEnvVars(['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET']) ? 'BROKEN' : 'NEVER_SETUP',
      rootCause: 'Pinterest app review required for write permissions (pins:write).',
      fixTime: '1-2 weeks — submit Pinterest app for review',
    },
    {
      platform: 'reddit',
      envVarsPresent: hasEnvVars(['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET']),
      status: hasEnvVars(['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET']) ? 'BROKEN' : 'NEVER_SETUP',
      rootCause: 'Reddit OAuth app not registered or no user OAuth tokens stored.',
      fixTime: '30 min — instant approval at reddit.com/prefs/apps',
    },
    {
      platform: 'bluesky',
      envVarsPresent: true,
      status: 'WORKING',
      rootCause: 'Uses app passwords — no OAuth app needed. Working if account + app password stored.',
      fixTime: 'N/A — working. Connect via Fanout dashboard → Add Bluesky profile.',
      note: 'Connect product accounts via dashboard, store as JSON {identifier, password} in product_platform_accounts',
    },
    {
      platform: 'mastodon',
      envVarsPresent: true,
      status: 'WORKING',
      rootCause: 'Instance-level OAuth — no central app needed. Working if instance token stored.',
      fixTime: 'N/A — working. Connect via Fanout dashboard.',
      note: 'Connect product accounts via dashboard Mastodon OAuth flow',
    },
    {
      platform: 'google_business_profile',
      envVarsPresent: hasEnvVars(['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']),
      status: 'BROKEN',
      rootCause: 'Google Business Profile API untested. Requires Google My Business API enabled and OAuth.',
      fixTime: '1-2 hours — enable Google My Business API in Cloud Console, test OAuth flow',
    },
  ]

  return checks
}

export function getWorkingPlatforms(): string[] {
  return getIntegrationAudit()
    .filter((c) => c.status === 'WORKING')
    .map((c) => c.platform)
}
