"use server"

import { auth } from "@clerk/nextjs/server"
import { getSupabase } from "@/lib/supabase"
import { PRODUCT_CONFIGS, PLATFORM_RULES, type Product } from "@/lib/product-platforms"
import { z } from "zod"

const Schema = z.object({
  product: z.string().min(1),
  platform: z.string().min(1),
  topic: z.string().optional(),
  queue: z.boolean().optional().default(false),
  scheduled_for: z.string().optional(),
})

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  if (!res.ok) throw new Error("Content generation failed")

  const data = (await res.json()) as {
    content?: Array<{ type: string; text: string }>
  }

  const content = data.content?.[0]?.text?.trim() ?? ""
  if (!content) throw new Error("Empty response from AI")
  return content
}

function checkGuardrails(content: string, guardrails: string[]): string | null {
  const lower = content.toLowerCase()
  for (const word of guardrails) {
    if (lower.includes(word.toLowerCase())) return word
  }
  return null
}

interface GenerateResult {
  content?: string
  queued?: boolean
  charCount?: number
  error?: string
}

export async function generateSocialContent(input: {
  product: string
  platform: string
  topic?: string
  queue?: boolean
}): Promise<GenerateResult> {
  const { userId } = await auth()
  if (!userId) return { error: "Unauthorized" }

  const parsed = Schema.safeParse(input)
  if (!parsed.success) return { error: "Invalid request" }

  const { product, platform, topic, queue } = parsed.data

  const productConfig = PRODUCT_CONFIGS[product as Product]
  if (!productConfig) return { error: `Unknown product: ${product}` }

  if (product === "wellness-engine" && productConfig.activationGate) {
    if (process.env.SQUARE_ENVIRONMENT !== "production") {
      return { error: "wellness-engine social posting is gated" }
    }
  }

  const platformRule = PLATFORM_RULES[platform]
  if (!platformRule) return { error: `Unknown platform: ${platform}` }

  if (platformRule.requiresImage) {
    return { error: `${platform} requires an image` }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return { error: "AI not configured" }

  const systemPrompt = `You are a social media copywriter for ${productConfig.name}.

PRODUCT CONTEXT:
- Name: ${productConfig.name}
- Tagline: ${productConfig.tagline}
- Target audience: ${productConfig.audience}
- Brand voice: ${productConfig.voice}
- Tone: ${productConfig.tone}
- DO NOT say or imply: ${productConfig.avoid}
- CTA (include naturally if space allows): ${productConfig.cta}
- Relevant hashtags to draw from: ${productConfig.hashtags.join(", ")}

PLATFORM RULES for ${platform}:
- Max effective characters: ${platformRule.effectiveMaxChars}
- Hashtag count: ${platformRule.hashtagCount}
- Style: ${platformRule.style}

OUTPUT RULES:
- Output ONLY the post content — no explanation, no quotes, no labels
- Stay strictly within the character limit
- Match the brand voice exactly
- Include exactly ${platformRule.hashtagCount} hashtags${platformRule.hashtagCount > 0 ? " at the end" : " (zero hashtags)"}
- Never start with "Introducing" or "Excited to announce"${productConfig.contentGuardrails ? `
- NEVER include these words: ${productConfig.contentGuardrails.join(", ")}` : ""}`

  const userPrompt = topic
    ? `Write a ${platform} post for ${productConfig.name} about: ${topic}`
    : `Write a ${platform} post for ${productConfig.name}. Pick a compelling, specific angle that would resonate with ${productConfig.audience}.`

  let content: string | undefined
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++
    try {
      content = await callClaude(systemPrompt, userPrompt, anthropicKey)
    } catch {
      return { error: "Content generation failed" }
    }

    const guardrails = productConfig.contentGuardrails ?? []
    const violation = checkGuardrails(content, guardrails)
    if (violation) {
      if (attempts < maxAttempts) continue
      return { error: `Content guardrail violation: contains "${violation}"` }
    }

    if (content.length > platformRule.maxChars) {
      if (attempts < maxAttempts) continue
      content = content.slice(0, platformRule.maxChars)
    }

    break
  }

  if (!content) return { error: "Generation failed after retries" }

  if (queue) {
    const supabase = getSupabase()
    const { error: insertError } = await supabase.from("social_posts_queue").insert({
      product,
      platform,
      content,
      scheduled_for: null,
      status: "pending",
    })

    if (insertError) {
      return { content, queued: false, error: insertError.message }
    }

    return { content, queued: true, charCount: content.length }
  }

  return { content, queued: false, charCount: content.length }
}
