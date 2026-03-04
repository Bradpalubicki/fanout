import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const DraftSchema = z.object({
  prompt: z.string().min(1).max(2000),
  platforms: z.array(z.string()).min(1).max(9),
  profileId: z.string().min(1),
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a social media expert. Generate platform-optimized post variants based on the user's topic or draft.

Platform rules:
- twitter: max 250 chars, punchy, conversational, 1-2 hashtags max
- linkedin: professional tone, 150-250 words, no slang, end with a question or CTA
- instagram: casual/visual language, 5-10 relevant hashtags appended at end
- facebook: friendly, 50-150 words, encourage engagement with a question
- tiktok: very short (under 100 chars), trendy, call to action
- pinterest: descriptive, keyword-rich, 2-3 hashtags
- youtube: engaging description, 100-200 words, includes keywords naturally
- reddit: authentic, community-first, no overt promotion, value-first
- threads: casual, conversational, slightly longer than twitter ok

Return ONLY valid JSON with no markdown fences:
{"variants": [{"platform": "twitter", "content": "..."}, ...]}`

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { prompt, platforms, profileId } = parsed.data

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

  const platformList = platforms.join(', ')
  const userPrompt = `Generate post variants for these platforms: ${platformList}\n\nTopic/draft: ${prompt}`

  let drafts: { platform: string; content: string }[] = []
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text) as { variants: { platform: string; content: string }[] }
    drafts = parsed.variants ?? []
  } catch (e) {
    console.error('AI generation error:', e)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  // Save drafts to DB
  if (drafts.length > 0) {
    await supabase.from('ai_drafts').insert({
      profile_id: profileId,
      prompt,
      generated: JSON.stringify(drafts),
      platforms,
      status: 'draft',
    })
  }

  return NextResponse.json({ drafts })
}
