export type PlatformKey =
  | 'twitter'
  | 'linkedin'
  | 'reddit'
  | 'youtube'
  | 'pinterest'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'threads'

export interface PlatformAutomationConfig {
  canAutomate: boolean
  requires2FA: boolean
  preferred2FAMethod: 'totp' | 'sms' | 'email' | 'none'
  sessionBased: boolean
  hasReview: boolean
  requiresMeta: boolean
  devPortalUrl: string
  devPortalLoginUrl: string
  callbackPath: string
  notes: string
}

export const PLATFORM_AUTOMATION: Record<PlatformKey, PlatformAutomationConfig> = {
  reddit: {
    canAutomate: true,
    requires2FA: false,
    preferred2FAMethod: 'totp',
    sessionBased: true,
    hasReview: false,
    requiresMeta: false,
    devPortalUrl: 'https://www.reddit.com/prefs/apps',
    devPortalLoginUrl: 'https://www.reddit.com/login',
    callbackPath: '/api/oauth/reddit/callback',
    notes: 'Instant approval. No review required. Easiest to automate.',
  },
  twitter: {
    canAutomate: true,
    requires2FA: true,
    preferred2FAMethod: 'totp',
    sessionBased: true,
    hasReview: false,
    requiresMeta: false,
    devPortalUrl: 'https://developer.twitter.com/en/portal/apps/new',
    devPortalLoginUrl: 'https://twitter.com/login',
    callbackPath: '/api/oauth/twitter/callback',
    notes: 'Requires Twitter Developer account. TOTP preferred for automation.',
  },
  linkedin: {
    canAutomate: true,
    requires2FA: true,
    preferred2FAMethod: 'totp',
    sessionBased: true,
    hasReview: true,
    requiresMeta: false,
    devPortalUrl: 'https://www.linkedin.com/developers/apps/new',
    devPortalLoginUrl: 'https://www.linkedin.com/login',
    callbackPath: '/api/oauth/linkedin/callback',
    notes: 'App requires manual product approval (Share on LinkedIn). Session-based automation possible.',
  },
  youtube: {
    canAutomate: true,
    requires2FA: true,
    preferred2FAMethod: 'totp',
    sessionBased: true,
    hasReview: false,
    requiresMeta: false,
    devPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    devPortalLoginUrl: 'https://accounts.google.com/signin',
    callbackPath: '/api/oauth/youtube/callback',
    notes: 'Google Cloud Console. Enable YouTube Data API v3. TOTP via Google Authenticator.',
  },
  pinterest: {
    canAutomate: false,
    requires2FA: true,
    preferred2FAMethod: 'sms',
    sessionBased: false,
    hasReview: true,
    requiresMeta: false,
    devPortalUrl: 'https://developers.pinterest.com/apps/',
    devPortalLoginUrl: 'https://www.pinterest.com/login/',
    callbackPath: '/api/oauth/pinterest/callback',
    notes: 'Requires app review for write permissions. Manual setup needed.',
  },
  tiktok: {
    canAutomate: false,
    requires2FA: true,
    preferred2FAMethod: 'sms',
    sessionBased: false,
    hasReview: true,
    requiresMeta: false,
    devPortalUrl: 'https://developers.tiktok.com/apps/',
    devPortalLoginUrl: 'https://www.tiktok.com/login',
    callbackPath: '/api/oauth/tiktok/callback',
    notes: 'Requires app review. Business account needed. Manual setup only.',
  },
  facebook: {
    canAutomate: false,
    requires2FA: true,
    preferred2FAMethod: 'sms',
    sessionBased: false,
    hasReview: true,
    requiresMeta: true,
    devPortalUrl: 'https://developers.facebook.com/apps/',
    devPortalLoginUrl: 'https://www.facebook.com/login',
    callbackPath: '/api/oauth/facebook/callback',
    notes: 'Meta Business Verification required. Uses shared Meta app with Instagram/Threads.',
  },
  instagram: {
    canAutomate: false,
    requires2FA: true,
    preferred2FAMethod: 'sms',
    sessionBased: false,
    hasReview: true,
    requiresMeta: true,
    devPortalUrl: 'https://developers.facebook.com/apps/',
    devPortalLoginUrl: 'https://www.facebook.com/login',
    callbackPath: '/api/oauth/instagram/callback',
    notes: 'Shares Meta app with Facebook/Threads. Business verification required.',
  },
  threads: {
    canAutomate: false,
    requires2FA: true,
    preferred2FAMethod: 'sms',
    sessionBased: false,
    hasReview: true,
    requiresMeta: true,
    devPortalUrl: 'https://developers.facebook.com/apps/',
    devPortalLoginUrl: 'https://www.facebook.com/login',
    callbackPath: '/api/oauth/threads/callback',
    notes: 'Shares Meta app with Facebook/Instagram. Business verification required.',
  },
}

export const AUTOMATABLE_PLATFORMS = (
  Object.entries(PLATFORM_AUTOMATION) as [PlatformKey, PlatformAutomationConfig][]
)
  .filter(([, cfg]) => cfg.canAutomate)
  .map(([platform]) => platform)

export const MANUAL_PLATFORMS = (
  Object.entries(PLATFORM_AUTOMATION) as [PlatformKey, PlatformAutomationConfig][]
)
  .filter(([, cfg]) => !cfg.canAutomate)
  .map(([platform]) => platform)
