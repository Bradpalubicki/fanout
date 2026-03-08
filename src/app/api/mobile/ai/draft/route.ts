import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

const DraftSchema = z.object({
  profileId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  platforms: z.array(z.string()).min(1).max(12),
})

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = user

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { profileId, prompt, platforms } = parsed.data

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let content = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Write a social media post for these platforms: ${platforms.join(', ')}.
Keep it within platform character limits.
User prompt: ${prompt}
Return only the post text, no explanation.`,
      }],
    })
    content = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } catch {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  // Save draft to ai_drafts table
  const { data: draft } = await supabase
    .from('ai_drafts')
    .insert({
      profile_id: profile.id,
      prompt,
      generated: content,
      platforms,
      status: 'draft',
    })
    .select('id')
    .single()

  return NextResponse.json({ content, draftId: draft?.id ?? '' })
}
