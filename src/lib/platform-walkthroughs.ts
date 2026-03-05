export interface PlatformWalkthrough {
  id: string
  name: string
  color: string
  textColor: string
  steps: string[]
  approving: string
  timeEstimate: string
  tips: string
  requiresReview: boolean
  requiresMeta: boolean
  videoUrl?: string
}

export const PLATFORM_WALKTHROUGHS: Record<string, PlatformWalkthrough> = {
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    color: 'bg-blue-700',
    textColor: 'text-white',
    steps: [
      'A LinkedIn authorization page will open in a new tab',
      'Review the permissions — Fanout will post updates on your behalf',
      'Click "Allow" to authorize',
      "You'll be redirected back to Fanout automatically",
    ],
    approving: 'Permission to publish posts and access your basic LinkedIn profile',
    timeEstimate: '~30 seconds',
    tips: "Make sure you're logged into your business LinkedIn account before clicking Connect.",
    requiresReview: false,
    requiresMeta: false,
  },
  twitter: {
    id: 'twitter',
    name: 'Twitter / X',
    color: 'bg-black',
    textColor: 'text-white',
    steps: [
      'A Twitter/X authorization page will open in a new tab',
      'Review the app permissions',
      'Click "Authorize app"',
      "You'll be redirected back automatically",
    ],
    approving: 'Permission to read your profile and post tweets on your behalf',
    timeEstimate: '~30 seconds',
    tips: 'Log into the Twitter account you want Fanout to post from before clicking Connect.',
    requiresReview: false,
    requiresMeta: false,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    color: 'bg-blue-600',
    textColor: 'text-white',
    steps: [
      'A Facebook authorization page will open',
      'Select which Facebook Page you want Fanout to post to',
      'Review and approve the permissions',
      'Choose the specific page from the dropdown',
      "Click \"Done\" — you'll return to Fanout automatically",
    ],
    approving: 'Permission to manage and publish to your Facebook Pages',
    timeEstimate: '~1 minute',
    tips: 'You must be an Admin of the Facebook Page to connect it. Personal profiles cannot be connected — only Pages.',
    requiresReview: false,
    requiresMeta: true,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    color: 'bg-pink-600',
    textColor: 'text-white',
    steps: [
      'An Instagram/Facebook authorization page will open',
      'Select the Instagram Business account linked to your Facebook Page',
      'Approve the permissions',
      "You'll return to Fanout automatically",
    ],
    approving: 'Permission to publish posts to your Instagram Business account',
    timeEstimate: '~1 minute',
    tips: 'Instagram must be a Professional (Business or Creator) account and linked to a Facebook Page. Personal Instagram accounts cannot be connected.',
    requiresReview: false,
    requiresMeta: true,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    color: 'bg-orange-500',
    textColor: 'text-white',
    steps: [
      'A Reddit authorization page will open in a new tab',
      'Review the permissions Fanout is requesting',
      'Click "Allow"',
      "You'll be redirected back automatically",
    ],
    approving: 'Permission to submit posts to subreddits on your behalf',
    timeEstimate: '~30 seconds',
    tips: 'Connect the Reddit account that has posting access to your target subreddits.',
    requiresReview: false,
    requiresMeta: false,
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    color: 'bg-red-600',
    textColor: 'text-white',
    steps: [
      'A Pinterest authorization page will open',
      'Review the permissions',
      'Click "Give access"',
      "You'll return to Fanout automatically",
    ],
    approving: 'Permission to create Pins on your boards',
    timeEstimate: '~30 seconds',
    tips: 'Connect a Pinterest Business account for best results. Personal accounts have posting limitations.',
    requiresReview: true,
    requiresMeta: false,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    color: 'bg-red-500',
    textColor: 'text-white',
    steps: [
      'A Google authorization page will open',
      'Select the Google account linked to your YouTube channel',
      'Review the permissions',
      'Click "Allow"',
      "You'll be redirected back automatically",
    ],
    approving: 'Permission to upload videos and manage your YouTube channel',
    timeEstimate: '~45 seconds',
    tips: 'Make sure you select the Google account that owns your YouTube channel.',
    requiresReview: false,
    requiresMeta: false,
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    color: 'bg-black',
    textColor: 'text-white',
    steps: [
      'A TikTok authorization page will open',
      'Log in to TikTok if prompted',
      'Review the permissions',
      'Tap "Authorize"',
      "You'll return to Fanout automatically",
    ],
    approving: 'Permission to upload and publish videos on your TikTok account',
    timeEstimate: '~45 seconds',
    tips: 'Connect the TikTok account you use for business. TikTok only supports video posts — text-only posts will be skipped.',
    requiresReview: true,
    requiresMeta: false,
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    color: 'bg-gray-900',
    textColor: 'text-white',
    steps: [
      'A Threads/Meta authorization page will open',
      'Review the permissions',
      'Click "Allow"',
      "You'll be redirected back automatically",
    ],
    approving: 'Permission to publish posts to your Threads account',
    timeEstimate: '~30 seconds',
    tips: 'Your Threads account must be connected to an Instagram account.',
    requiresReview: false,
    requiresMeta: true,
  },
}

export const WIZARD_ORDER = [
  'linkedin',
  'twitter',
  'facebook',
  'instagram',
  'reddit',
  'pinterest',
  'youtube',
  'tiktok',
  'threads',
]
