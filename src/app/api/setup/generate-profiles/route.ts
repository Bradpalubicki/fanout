import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const BIO_LIMITS: Record<string, number> = {
  twitter: 160,
  linkedin: 2000,
  instagram: 150,
  facebook: 255,
  tiktok: 80,
  pinterest: 500,
  youtube: 1000,
  reddit: 200,
  threads: 160,
  google_business_profile: 750,
  bluesky: 300,
  mastodon: 500,
}

const schema = z.object({
  brandData: z.object({
    tagline: z.string(),
    about: z.string(),
    services: z.array(z.string()),
    tone: z.string(),
  }),
  platforms: z.array(z.string()),
  businessInfo: z.object({
    name: z.string(),
    category: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
})

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { brandData, platforms, businessInfo } = parsed.data

  const platformsWithLimits = platforms.map((p) => `${p} (max ${BIO_LIMITS[p] ?? 300} chars)`).join(', ')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Generate social media profile bios for this business. Return ONLY valid JSON.

Business: ${businessInfo.name}
Category: ${businessInfo.category}
Location: ${businessInfo.city ?? ''} ${businessInfo.state ?? ''}
Tagline: ${brandData.tagline}
About: ${brandData.about}
Services: ${brandData.services.join(', ')}
Brand tone: ${brandData.tone}

Platforms needed: ${platformsWithLimits}

For each platform, optimize the bio for that platform's culture and audience.
- Twitter/X: punchy, conversational, emoji ok
- LinkedIn: professional, credentials-forward
- Instagram: visual storytelling, hashtag-friendly
- Facebook: community-focused, warm
- TikTok: casual, trendy, brief
- Pinterest: keyword-rich, descriptive
- YouTube: searchable, includes what content you post
- Reddit: genuine, no-marketing tone
- Google Business: service-focused, local SEO
- Bluesky: casual, open web spirit
- Mastodon: community-minded, no corporate speak

Return JSON array:
[
  {
    "platform": "twitter",
    "displayName": "${businessInfo.name}",
    "bio": "optimized bio within char limit",
    "hashtags": ["relevant", "hashtags", "for", "this", "business"]
  }
]`,
    }],
  })

  const text = (msg.content[0] as { type: string; text: string }).text.trim()
  try {
    const profiles = JSON.parse(text) as Array<{
      platform: string
      displayName: string
      bio: string
      hashtags: string[]
    }>
    return NextResponse.json({ profiles })
  } catch {
    return NextResponse.json({ profiles: [] })
  }
}
