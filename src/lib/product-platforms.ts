// Product → platform mapping for the social posting agent
// These are NuStack's own products, not Fanout client accounts

export const PRODUCTS = ['certusaudit', 'pocketpals', 'sitegrade', 'wellness-engine'] as const
export type Product = (typeof PRODUCTS)[number]

// NOTE: appraiser-engine is deferred — add to social queue when Bible score hits 28/35
// and core appraisal feature is live. Do not activate before then.

export interface ProductConfig {
  name: string
  handle: string
  email: string
  tagline: string
  audience: string
  voice: string
  tone: string
  avoid: string
  cta: string
  hashtags: string[]
  platforms: string[]
  contentGuardrails?: string[]
  activationGate?: string
}

export const PRODUCT_CONFIGS: Record<Product, ProductConfig> = {
  certusaudit: {
    name: 'CertusAudit',
    handle: '@CertusAudit',
    email: 'certusaudit@nustack.digital',
    tagline: 'ADA Title II compliance scanner for government entities',
    audience: 'Government IT directors, compliance officers, city managers, agency CIOs',
    voice:
      'Authoritative and compliance-focused. Every government entity with a public website now has a legal obligation under ADA Title II. CertusAudit makes it simple to know where you stand.',
    tone: 'formal, precise, credible, urgent — but not fear-mongering',
    avoid: 'jargon, vague promises, exaggeration, consumer-facing language',
    cta: 'Scan your site free at certusaudit.co',
    hashtags: ['#ADA', '#Compliance', '#GovTech', '#Accessibility', '#Section508'],
    platforms: ['twitter', 'linkedin'],
  },
  pocketpals: {
    name: 'PocketPals',
    handle: '@PocketPalsApp',
    email: 'pocketpals@nustack.digital',
    tagline: 'AI companion that grows with your child from age 3 to 12',
    audience: 'Parents of young children ages 3-12, especially parents of early readers',
    voice:
      'Warm, parent-focused, encouraging. "Your child\'s new favorite learning companion." This is an AI companion built for kids — safe, joyful, and built to earn parents\' trust.',
    tone: 'friendly, safe, wonder-filled, trustworthy — never techy or clinical',
    avoid: 'scary AI language, anything implying screen addiction, pressure tactics, anything not parent-approved feeling',
    cta: 'Meet Buddy at pocketpals.app',
    hashtags: ['#KidsApp', '#ParentingTips', '#EdTech', '#KidsSafety', '#LearningApps'],
    platforms: ['twitter', 'instagram', 'tiktok'],
  },
  sitegrade: {
    name: 'SiteGrade',
    handle: '@SiteGradeApp',
    email: 'sitegrade@nustack.digital',
    tagline: 'Website grader for local businesses and agencies',
    audience: 'SMB owners, local marketing agencies, web designers, anyone who owns a business website',
    voice:
      'Direct, ROI-focused, no-nonsense. "Your site is losing you customers. SiteGrade shows you exactly how." Numbers over adjectives. Specific over vague.',
    tone: 'punchy, numbers-driven, direct, no-fluff',
    avoid: 'corporate speak, vague promises, technical jargon the SMB owner doesn\'t care about',
    cta: 'Grade your site free at sitegrade.co',
    hashtags: ['#SEO', '#WebDesign', '#LocalBusiness', '#DigitalMarketing', '#SmallBusiness'],
    platforms: ['twitter', 'linkedin'],
  },
  'wellness-engine': {
    name: 'Wellness Engine',
    handle: '@WellnessEngine',
    email: 'wellness@nustack.digital',
    tagline: 'All-in-one platform for wellness clinics',
    audience: 'Clinic owners, practice managers, wellness entrepreneurs — NOT patients',
    voice:
      'Professional and clinic-focused. Speaks to the operational burden of running a modern wellness practice. Never speaks to patients. Never makes clinical claims.',
    tone: 'professional, efficient, results-focused, peer-to-business',
    avoid: 'medical claims, health outcome promises, HIPAA-sensitive language, patient-facing language',
    cta: 'See it at wellnessengine.io',
    hashtags: ['#WellnessClinic', '#PracticeManagement', '#HealthTech', '#ClinicalOperations'],
    platforms: ['twitter', 'linkedin'],
    // GUARDRAIL: Regenerate if content contains any of these words
    contentGuardrails: [
      'cure', 'treat', 'heal', 'diagnose', 'patient outcomes',
      'improves health', 'medical results', 'clinical outcomes',
      'FDA', 'HIPAA compliant', 'recover', 'symptom',
    ],
    // Do not activate posting until Square is confirmed in production
    activationGate: 'SQUARE_ENVIRONMENT must equal "production" before activating wellness-engine social posting',
  },
}

// Platform character limits and content rules
export const PLATFORM_RULES: Record<string, {
  maxChars: number
  effectiveMaxChars: number  // leave room for links/handles
  hashtagCount: number
  requiresImage: boolean
  style: string
}> = {
  twitter: {
    maxChars: 280,
    effectiveMaxChars: 250,
    hashtagCount: 2,
    requiresImage: false,
    style: 'Punchy, single insight or stat. Hook in first 5 words. 1-2 hashtags max. Leave room for a link.',
  },
  linkedin: {
    maxChars: 3000,
    effectiveMaxChars: 2000,
    hashtagCount: 5,
    requiresImage: false,
    style: 'Professional. 150-250 words. Line breaks for readability. End with a question or CTA. 3-5 hashtags.',
  },
  instagram: {
    maxChars: 2200,
    effectiveMaxChars: 150,
    hashtagCount: 10,
    requiresImage: true,  // Instagram REQUIRES an image — text-only posts do not exist
    style: 'Caption under 150 chars + 10 hashtags. First line is the hook (visible before "more"). Image is mandatory.',
  },
  tiktok: {
    maxChars: 2200,
    effectiveMaxChars: 150,
    hashtagCount: 5,
    requiresImage: false,  // TikTok needs video, not just image
    style: 'Hook in first 3 words. Under 150 chars. 3-5 trending hashtags. High energy and conversational.',
  },
  bluesky: {
    maxChars: 300,
    effectiveMaxChars: 270,
    hashtagCount: 2,
    requiresImage: false,
    style: 'Conversational, slightly more casual than Twitter. 1-2 hashtags.',
  },
  reddit: {
    maxChars: 40000,
    effectiveMaxChars: 5000,
    hashtagCount: 0,
    requiresImage: false,
    style: 'Informative, community-first. No hashtags. Add real value — not just promotion. Title must hook.',
  },
  mastodon: {
    maxChars: 500,
    effectiveMaxChars: 450,
    hashtagCount: 3,
    requiresImage: false,
    style: 'Thoughtful, open-web audience. 2-3 hashtags. Longer form ok.',
  },
}

// Per-platform rate limits for the posting agent
// These limits apply per 6-hour cron window
export const PLATFORM_RATE_LIMITS: Record<string, number> = {
  twitter: 5,    // Twitter free tier: 50/day, be conservative
  linkedin: 3,   // LinkedIn: 100/day but throttle for quality
  instagram: 2,  // Instagram: avoid looking spammy
  tiktok: 2,
  bluesky: 10,
  mastodon: 10,
  reddit: 1,     // Reddit is very spam-sensitive
  facebook: 3,
  threads: 3,
  youtube: 1,
  pinterest: 5,
  google_business_profile: 2,
}
