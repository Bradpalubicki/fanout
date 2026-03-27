import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { PRODUCT_CONFIGS, PLATFORM_RULES, type Product } from '@/lib/product-platforms'
import { z } from 'zod'

const Schema = z.object({
  product: z.enum(['certusaudit', 'pocketpals', 'sitegrade', 'wellness-engine']),
  platform: z.string().min(1),
  topic: z.string().optional(),
  queue: z.boolean().optional().default(false),
  scheduled_for: z.string().optional(), // ISO date string
})

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Claude API error: ${errBody}`)
  }

  const data = await res.json() as {
    content?: Array<{ type: string; text: string }>
    error?: { message: string }
  }

  const content = data.content?.[0]?.text?.trim() ?? ''
  if (!content) throw new Error('Empty response from Claude')
  return content
}

function checkGuardrails(content: string, guardrails: string[]): string | null {
  const lower = content.toLowerCase()
  for (const word of guardrails) {
    if (lower.includes(word.toLowerCase())) return word
  }
  return null
}

export async function POST(req: NextRequest) {
  // Auth: require CRON_SECRET or INTERNAL_API_KEY
  const authHeader = req.headers.get('authorization')
  const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isInternalKey = authHeader === `Bearer ${process.env.INTERNAL_API_KEY}`

  if (!isCronAuth && !isInternalKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { product, platform, topic, queue, scheduled_for } = parsed.data

  const productConfig = PRODUCT_CONFIGS[product as Product]
  if (!productConfig) {
    return NextResponse.json({ error: `Unknown product: ${product}` }, { status: 400 })
  }

  // Check activation gate for wellness-engine
  if (product === 'wellness-engine' && productConfig.activationGate) {
    const squareEnv = process.env.SQUARE_ENVIRONMENT
    if (squareEnv !== 'production') {
      return NextResponse.json({
        error: 'wellness-engine social posting is gated: SQUARE_ENVIRONMENT must be "production" first.',
        gate: productConfig.activationGate,
      }, { status: 403 })
    }
  }

  const platformRule = PLATFORM_RULES[platform]
  if (!platformRule) {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 })
  }

  // Check if this platform requires an image (Instagram)
  if (platformRule.requiresImage) {
    return NextResponse.json({
      error: `${platform} requires an image — pass image_url or use the visual content endpoint`,
      requiresImage: true,
    }, { status: 400 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const systemPrompt = `You are a social media copywriter for ${productConfig.name}.

PRODUCT CONTEXT:
- Name: ${productConfig.name}
- Tagline: ${productConfig.tagline}
- Target audience: ${productConfig.audience}
- Brand voice: ${productConfig.voice}
- Tone: ${productConfig.tone}
- DO NOT say or imply: ${productConfig.avoid}
- CTA (include naturally if space allows): ${productConfig.cta}
- Relevant hashtags to draw from: ${productConfig.hashtags.join(', ')}

PLATFORM RULES for ${platform}:
- Max effective characters: ${platformRule.effectiveMaxChars}
- Hashtag count: ${platformRule.hashtagCount}
- Style: ${platformRule.style}

OUTPUT RULES:
- Output ONLY the post content — no explanation, no quotes, no labels, no "Here's a post:"
- Stay strictly within the character limit
- Match the brand voice exactly — never sound generic or corporate
- Include exactly ${platformRule.hashtagCount} hashtags${platformRule.hashtagCount > 0 ? ' at the end' : ' (zero hashtags on this platform)'}
- Never start with "Introducing" or "Excited to announce"${productConfig.contentGuardrails ? `
- NEVER include these words or phrases: ${productConfig.contentGuardrails.join(', ')}` : ''}`

  const userPrompt = topic
    ? `Write a ${platform} post for ${productConfig.name} about: ${topic}`
    : `Write a ${platform} post for ${productConfig.name}. Pick a compelling, specific angle that would resonate with ${productConfig.audience}. Be concrete — avoid vague claims. Make it feel like it came from someone who deeply understands the industry.`

  let content: string
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++
    try {
      content = await callClaude(systemPrompt, userPrompt, anthropicKey)
    } catch (e) {
      return NextResponse.json({
        error: `Claude request failed: ${e instanceof Error ? e.message : String(e)}`,
      }, { status: 500 })
    }

    // Check guardrails (wellness-engine and any other products with restrictions)
    const guardrails = productConfig.contentGuardrails ?? []
    const violation = checkGuardrails(content, guardrails)
    if (violation) {
      if (attempts < maxAttempts) {
        // Retry with stricter instruction
        console.warn(`[generate-social-content] Guardrail violation "${violation}" — attempt ${attempts + 1}`)
        continue
      } else {
        return NextResponse.json({
          error: `Content guardrail violation after ${maxAttempts} attempts: contains "${violation}". Check product voice config.`,
          violation,
        }, { status: 422 })
      }
    }

    // Check character limit
    if (content.length > platformRule.maxChars) {
      if (attempts < maxAttempts) continue
      // Truncate as last resort (prefer regeneration)
      content = content.slice(0, platformRule.maxChars)
    }

    break
  }

  // Queue the post if requested
  if (queue) {
    const supabase = getSupabase()
    const { error: insertError } = await supabase.from('social_posts_queue').insert({
      product,
      platform,
      content: content!,
      scheduled_for: scheduled_for ?? null,
      status: 'pending',
    })

    if (insertError) {
      return NextResponse.json({ content: content!, queued: false, error: insertError.message })
    }

    return NextResponse.json({ content: content!, queued: true, charCount: content!.length })
  }

  return NextResponse.json({ content: content!, queued: false, charCount: content!.length })
}
