export interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientIdEnv: string
  clientSecretEnv: string
  callbackEnv: string
}

export const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.write', 'tweet.read', 'users.read', 'offline.access'],
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    callbackEnv: 'TWITTER_CALLBACK_URL',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    // r_liteprofile is deprecated — removed. openid+profile+email = OIDC flow for user identity.
    // w_member_social = post on behalf of member. w_organization_social needed for company pages.
    scopes: ['w_member_social', 'openid', 'profile', 'email'],
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    callbackEnv: 'LINKEDIN_CALLBACK_URL',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_show_list', 'pages_read_engagement'],
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    callbackEnv: 'FACEBOOK_CALLBACK_URL',
  },
  pinterest: {
    authUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: ['pins:write', 'boards:read', 'user_accounts:read'],
    clientIdEnv: 'PINTEREST_APP_ID',
    clientSecretEnv: 'PINTEREST_APP_SECRET',
    callbackEnv: 'PINTEREST_CALLBACK_URL',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ],
    clientIdEnv: 'YOUTUBE_CLIENT_ID',
    clientSecretEnv: 'YOUTUBE_CLIENT_SECRET',
    callbackEnv: 'YOUTUBE_CALLBACK_URL',
  },
  instagram: {
    // Instagram Business/Creator publishing requires the Facebook OAuth dialog (Graph API),
    // NOT api.instagram.com which is the deprecated Basic Display API.
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
    callbackEnv: 'FACEBOOK_CALLBACK_URL',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['video.upload', 'video.publish', 'user.info.basic'],
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    callbackEnv: 'TIKTOK_CALLBACK_URL',
  },
  reddit: {
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scopes: ['submit', 'read', 'identity'],
    clientIdEnv: 'REDDIT_CLIENT_ID',
    clientSecretEnv: 'REDDIT_CLIENT_SECRET',
    callbackEnv: 'REDDIT_CALLBACK_URL',
  },
  threads: {
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: ['threads_basic', 'threads_content_publish'],
    clientIdEnv: 'THREADS_APP_ID',
    clientSecretEnv: 'THREADS_APP_SECRET',
    callbackEnv: 'FACEBOOK_CALLBACK_URL',
  },
  google_business_profile: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    clientIdEnv: 'GBP_CLIENT_ID',
    clientSecretEnv: 'GBP_CLIENT_SECRET',
    callbackEnv: 'GBP_CALLBACK_URL',
  },
  bluesky: {
    // Bluesky uses app passwords (not OAuth2) — stub config for UI display
    authUrl: '',
    tokenUrl: '',
    scopes: [],
    clientIdEnv: '',
    clientSecretEnv: '',
    callbackEnv: '',
  },
  mastodon: {
    // Mastodon uses per-instance OAuth2 — stub config for UI display
    authUrl: '',
    tokenUrl: '',
    scopes: ['write:statuses', 'read:accounts'],
    clientIdEnv: '',
    clientSecretEnv: '',
    callbackEnv: '',
  },
}
