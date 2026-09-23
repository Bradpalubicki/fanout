export interface OAuthConfig {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  clientIdEnv: string
  clientSecretEnv: string
  callbackEnv: string
  /**
   * Whether the granted scopes permit reading posts the account created OUTSIDE
   * Fanout ("native history"). This is a fact about what the provider will let
   * us read — not a claim that we have built the reader yet.
   *
   * Declared here so the answer lives next to the scopes that determine it, and
   * so public "supported platforms" copy can be derived rather than asserted.
   * Anything false must never be advertised as offering native history.
   */
  nativeHistory: boolean
  /** Why nativeHistory is false. Null when it is true. */
  nativeHistoryBlocker: string | null
}

export const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.write', 'tweet.read', 'users.read', 'offline.access'],
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    callbackEnv: 'TWITTER_CALLBACK_URL',
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    // r_liteprofile is deprecated — removed. openid+profile+email = OIDC flow for user identity.
    // w_member_social = post on behalf of member. w_organization_social needed for company pages.
    //
    // NATIVE HISTORY IS BLOCKED ON LINKEDIN (verified 2026-09-23).
    // Reading a member's own posts requires r_member_social, which LinkedIn
    // documents as a CLOSED permission — they are not accepting access requests.
    // It is therefore NOT added here: requesting an unapproved scope fails the
    // whole authorization, so adding it speculatively would break LinkedIn
    // sign-in entirely rather than just degrade history.
    // Consequence: LinkedIn supports POSTING and, for history, only what Fanout
    // itself sent. Do not advertise native LinkedIn history.
    // Revisit only via the Community Management API Standard-tier program.
    scopes: ['w_member_social', 'openid', 'profile', 'email'],
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    callbackEnv: 'LINKEDIN_CALLBACK_URL',
    nativeHistory: false,
    nativeHistoryBlocker: 'r_member_social is a CLOSED permission — LinkedIn is not accepting access requests',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    // business_management is required for Pages owned by a BUSINESS PORTFOLIO.
    // Without it /me/accounts returns only Pages the user personally
    // administers, so a client whose Page sits in a Business portfolio sees an
    // empty or partial picker and cannot connect the Page they actually want.
    // Reported independently on 2026-09-23 by a pilot user ("it only finds one
    // of the pages I created... the only page showing is one that is not
    // connected to a business portfolio") and by a CFC audit run.
    // This is the normal shape for agency clients, so it is not an edge case.
    scopes: [
      'pages_manage_posts',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ],
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    callbackEnv: 'FACEBOOK_CALLBACK_URL',
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  pinterest: {
    authUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: ['pins:write', 'boards:read', 'user_accounts:read'],
    clientIdEnv: 'PINTEREST_APP_ID',
    clientSecretEnv: 'PINTEREST_APP_SECRET',
    callbackEnv: 'PINTEREST_CALLBACK_URL',
    nativeHistory: false,
    nativeHistoryBlocker: 'boards:read/pins:read cover boards, not an account-wide post feed — reader unproven',
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
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  instagram: {
    // Instagram Business/Creator publishing requires the Facebook OAuth dialog (Graph API),
    // NOT api.instagram.com which is the deprecated Basic Display API.
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    // business_management for the same reason as facebook: IG Business accounts
    // are reached THROUGH /me/accounts, so a Page in a Business portfolio hides
    // its linked Instagram account too.
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'business_management',
    ],
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
    // Must be its OWN callback path. The callback handler derives `platform` from the
    // route segment and matches oauth_state on it, so sending Instagram to
    // /api/oauth/facebook/callback looked up platform='facebook' against a state row
    // written as 'instagram' — 0 rows, and the user saw a misleading ?error=invalid_state.
    callbackEnv: 'INSTAGRAM_CALLBACK_URL',
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    // video.list is required to read a user's own posts for native history.
    // It is a standard requestable scope (Display API), unlike LinkedIn's.
    // Added BEFORE client connections: adding a scope later forces every
    // connected account to re-consent.
    scopes: ['video.upload', 'video.publish', 'user.info.basic', 'video.list'],
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    callbackEnv: 'TIKTOK_CALLBACK_URL',
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  reddit: {
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scopes: ['submit', 'read', 'identity'],
    clientIdEnv: 'REDDIT_CLIENT_ID',
    clientSecretEnv: 'REDDIT_CLIENT_SECRET',
    callbackEnv: 'REDDIT_CALLBACK_URL',
    // The 'read' scope is already granted, so /user/{name}/submitted is readable.
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  threads: {
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: ['threads_basic', 'threads_content_publish'],
    clientIdEnv: 'THREADS_APP_ID',
    clientSecretEnv: 'THREADS_APP_SECRET',
    // Its own callback path — see the instagram entry above.
    callbackEnv: 'THREADS_CALLBACK_URL',
    nativeHistory: false,
    nativeHistoryBlocker: 'shares the Meta app but has its own posts API — reader unproven',
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
    nativeHistory: false,
    nativeHistoryBlocker: 'Google My Business API access not yet approved',
  },
  bluesky: {
    // Bluesky uses app passwords (not OAuth2) — stub config for UI display
    authUrl: '',
    tokenUrl: '',
    scopes: [],
    clientIdEnv: '',
    clientSecretEnv: '',
    callbackEnv: '',
    // app.bsky.feed.getAuthorFeed is public and needs no additional grant.
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
  mastodon: {
    // Mastodon uses per-instance OAuth2 — stub config for UI display
    authUrl: '',
    tokenUrl: '',
    scopes: ['write:statuses', 'read:accounts'],
    clientIdEnv: '',
    clientSecretEnv: '',
    callbackEnv: '',
    // read:accounts covers GET /api/v1/accounts/:id/statuses.
    nativeHistory: true,
    nativeHistoryBlocker: null,
  },
}
