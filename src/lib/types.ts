export interface Profile {
  id: string
  org_id: string
  name: string
  slug: string
  api_key_hash: string | null
  webhook_url: string | null
  timezone: string
  created_at: string
}

export interface OAuthToken {
  id: string
  profile_id: string
  platform: string
  access_token: string
  refresh_token: string | null
  token_secret: string | null
  expires_at: string | null
  scopes: string[] | null
  platform_user_id: string | null
  platform_username: string | null
  platform_page_id: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  profile_id: string
  content: string
  platforms: string[]
  media_urls: string[] | null
  scheduled_for: string | null
  status: 'pending' | 'posting' | 'posted' | 'failed' | 'draft' | 'pending_approval'
  source: 'api' | 'dashboard' | 'ai_generated'
  ai_draft_id: string | null
  created_by: string | null
  created_at: string
}

export interface PostResult {
  id: string
  post_id: string
  platform: string
  status: 'success' | 'failed'
  platform_post_id: string | null
  platform_post_url: string | null
  error_message: string | null
  attempts: number
  posted_at: string | null
  created_at: string
}

export interface AnalyticsSnapshot {
  id: string
  post_result_id: string
  platform: string
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  clicks: number | null
  reach: number | null
  collected_at: string
}

export interface AiDraft {
  id: string
  profile_id: string
  prompt: string
  generated: string
  platforms: string[] | null
  status: 'draft' | 'approved' | 'rejected' | 'posted'
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export type Platform =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'pinterest'
  | 'youtube'
  | 'reddit'
  | 'threads'

export const SUPPORTED_PLATFORMS: Platform[] = [
  'twitter',
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'pinterest',
  'youtube',
  'reddit',
  'threads',
]

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  reddit: 'Reddit',
  threads: 'Threads',
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
  facebook: '#1877F2',
  instagram: '#E4405F',
  tiktok: '#000000',
  pinterest: '#E60023',
  youtube: '#FF0000',
  reddit: '#FF4500',
  threads: '#000000',
}
