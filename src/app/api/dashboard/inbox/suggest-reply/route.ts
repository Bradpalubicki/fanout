import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const schema = z.object({
  itemId: z.string(),
  senderName: z.string(),
  content: z.string(),
  platform: z.string(),
  type: z.string(),
})

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { senderName, content, platform, type } = parsed.data

  const platformTone: Record<string, string> = {
    twitter: 'brief and conversational, under 280 characters',
    instagram: 'warm and friendly, emoji ok',
    facebook: 'community-focused and helpful',
    linkedin: 'professional and thoughtful',
    youtube: 'appreciative and engaging',
  }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Generate a reply to this ${type} from ${senderName} on ${platform}.

Their message: "${content}"

Write a professional, helpful reply. Tone: ${platformTone[platform] ?? 'friendly and professional'}.
Write ONLY the reply text, nothing else.`,
    }],
  })

  const reply = (msg.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json({ reply })
}
