import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const schema = z.object({
  websiteUrl: z.string().url(),
  businessInfo: z.object({
    name: z.string(),
    category: z.string(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
})

const anthropic = new Anthropic()

async function scrapeWithFirecrawl(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return ''
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 15000,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json() as { data?: { markdown?: string } }
    return data.data?.markdown ?? ''
  } catch {
    return ''
  }
}

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

  const { websiteUrl, businessInfo } = parsed.data

  // Scrape website
  const scraped = await scrapeWithFirecrawl(websiteUrl)

  // Extract brand with Claude
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract brand information from this business website content. Return ONLY valid JSON with no markdown.

Business: ${businessInfo.name}
Category: ${businessInfo.category}
Location: ${businessInfo.city ?? ''}, ${businessInfo.state ?? ''}

Website content:
${scraped.slice(0, 8000) || 'No website content available — use business info only.'}

Return JSON:
{
  "tagline": "short compelling tagline (10-15 words)",
  "about": "2-3 sentence about/mission statement",
  "services": ["service1", "service2", "service3"],
  "tone": "describe the brand tone (e.g. professional, friendly, playful, authoritative)",
  "colors": ["#hex1", "#hex2"],
  "logoUrl": "logo URL if found or empty string",
  "photosFound": 0
}`,
    }],
  })

  const text = (msg.content[0] as { type: string; text: string }).text.trim()
  try {
    const brandData = JSON.parse(text) as {
      tagline: string
      about: string
      services: string[]
      tone: string
      colors: string[]
      logoUrl: string
      photosFound: number
    }
    return NextResponse.json({ brandData })
  } catch {
    // Fallback if JSON parse fails
    return NextResponse.json({
      brandData: {
        tagline: businessInfo.name,
        about: `${businessInfo.name} is a ${businessInfo.category} business.`,
        services: [],
        tone: 'professional and friendly',
        colors: [],
        logoUrl: '',
        photosFound: 0,
      },
    })
  }
}
