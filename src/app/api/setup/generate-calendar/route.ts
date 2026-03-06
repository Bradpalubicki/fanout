import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const schema = z.object({
  brandData: z.record(z.string(), z.unknown()).nullable(),
  platforms: z.array(z.string()),
  orgId: z.string(),
  profileId: z.string(),
  businessInfo: z.object({
    name: z.string(),
    category: z.string(),
    tone: z.string().optional(),
  }).optional(),
})

const anthropic = new Anthropic()

// Optimal post times: 9am, 12pm, 5pm rotated
const POST_TIMES = ['09:00', '12:00', '17:00']

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { brandData, platforms, orgId, profileId, businessInfo } = parsed.data

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const brand = brandData as Record<string, unknown> | null
  const businessName = businessInfo?.name ?? (brand?.tagline as string) ?? 'the business'
  const category = businessInfo?.category ?? 'business'
  const about = (brand?.about as string) ?? ''
  const services = (brand?.services as string[]) ?? []
  const tone = businessInfo?.tone ?? (brand?.tone as string) ?? 'professional and friendly'

  // Generate 30 days of posts via Claude
  const platformList = platforms.slice(0, 6).join(', ')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Generate a 30-day social media content calendar for this business. Return ONLY valid JSON.

Business: ${businessName}
Category: ${category}
About: ${about}
Services: ${services.join(', ')}
Tone: ${tone}
Platforms: ${platformList}

Create 3-4 posts per week (about 15-18 total posts). Mix content types:
- Educational/tips (30%)
- Promotional/services (25%)
- Behind-the-scenes (20%)
- Engagement/questions (15%)
- Industry commentary (10%)

For platform formatting:
- LinkedIn: thought leadership, professional, longer form
- Instagram: visual storytelling, hashtags, emoji
- Twitter/X: punchy takes, under 240 chars
- Facebook: community engagement, conversational
- TikTok: trending formats, brief hooks
- Pinterest: tips and how-to, descriptive
- YouTube: searchable titles and descriptions
- Reddit: genuine value, no marketing speak
- Google Business: service announcements, local news

Return JSON:
{
  "posts": [
    {
      "content": "post text (platform-optimized for first platform in list)",
      "platforms": ["platform1", "platform2"],
      "dayOffset": 1,
      "timeSlot": 0,
      "contentType": "educational|promotional|behind_scenes|engagement|commentary"
    }
  ]
}

Use dayOffset 1-30 and timeSlot 0/1/2 (maps to 9am/12pm/5pm). Spread posts evenly.`,
    }],
  })

  const text = (msg.content[0] as { type: string; text: string }).text.trim()

  let posts: Array<{
    content: string
    platforms: string[]
    dayOffset: number
    timeSlot: number
    contentType: string
  }> = []

  try {
    const parsed2 = JSON.parse(text) as { posts: typeof posts }
    posts = parsed2.posts ?? []
  } catch {
    return NextResponse.json({ error: 'Failed to parse generated calendar' }, { status: 500 })
  }

  // Insert posts into DB
  const now = new Date()
  const postsToInsert = posts.map((p) => {
    const schedDate = new Date(now)
    schedDate.setDate(now.getDate() + (p.dayOffset ?? 1))
    const [h, m] = (POST_TIMES[p.timeSlot ?? 0] ?? '09:00').split(':').map(Number)
    schedDate.setHours(h, m, 0, 0)

    return {
      profile_id: profileId,
      content: p.content,
      platforms: p.platforms.length ? p.platforms : platforms.slice(0, 2),
      status: 'pending_approval',
      source: 'ai_generated',
      scheduled_for: schedDate.toISOString(),
    }
  })

  const { data: inserted, error } = await supabase
    .from('posts')
    .insert(postsToInsert)
    .select('id')

  if (error) {
    return NextResponse.json({ error: 'Failed to save posts' }, { status: 500 })
  }

  return NextResponse.json({
    postsCreated: inserted?.length ?? 0,
    platforms,
    firstPostAt: postsToInsert[0]?.scheduled_for,
  })
}
