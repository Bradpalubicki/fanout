import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import FirecrawlApp from '@mendable/firecrawl-js'
import { generateApiKey, hashApiKey } from '@/lib/crypto'

function getFirecrawl() {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new Error('FIRECRAWL_API_KEY not configured')
  return new FirecrawlApp({ apiKey: key })
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

const MessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
})

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_profile',
    description: 'Create a new Fanout profile for the client. Call this once you have enough info about their business name and timezone.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Business or brand name (e.g. "AK Dental Chicago")' },
        slug: { type: 'string', description: 'URL-safe slug, lowercase letters/numbers/hyphens only (e.g. "ak-dental-chicago")' },
        timezone: { type: 'string', description: 'IANA timezone, e.g. America/Chicago', default: 'America/Chicago' },
        industry: { type: 'string', description: 'Industry or vertical, e.g. dental, wellness, fitness' },
      },
      required: ['name', 'slug', 'timezone', 'industry'],
    },
  },
  {
    name: 'set_tone_config',
    description: 'Store the brand voice, posting topics, and hashtag strategy for a profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profile_id: { type: 'string' },
        tone: { type: 'string', description: 'e.g. professional, casual, educational, inspirational, humorous' },
        topics: { type: 'array', items: { type: 'string' }, description: 'Key content topics (3-7 items)' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Core hashtags without # (5-10 items)' },
        cta_style: { type: 'string', description: 'Preferred call-to-action style, e.g. "Book a free consult", "Learn more", "DM us"' },
        avoid: { type: 'string', description: 'Topics or phrases to always avoid' },
      },
      required: ['profile_id', 'tone', 'topics', 'hashtags'],
    },
  },
  {
    name: 'set_schedule',
    description: 'Set posting frequency and preferred posting times for specific platforms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profile_id: { type: 'string' },
        platforms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              platform: { type: 'string' },
              posts_per_week: { type: 'number' },
              preferred_days: { type: 'array', items: { type: 'string' }, description: 'e.g. ["Monday","Wednesday","Friday"]' },
              preferred_time: { type: 'string', description: '24h HH:MM, e.g. "09:00"' },
            },
            required: ['platform', 'posts_per_week', 'preferred_days', 'preferred_time'],
          },
        },
      },
      required: ['profile_id', 'platforms'],
    },
  },
  {
    name: 'generate_seed_posts',
    description: 'Generate 5 sample posts to seed the queue for this profile. Call this after set_tone_config.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profile_id: { type: 'string' },
        business_description: { type: 'string', description: 'Brief summary of the business for context' },
        platforms: { type: 'array', items: { type: 'string' } },
        tone: { type: 'string' },
        topics: { type: 'array', items: { type: 'string' } },
      },
      required: ['profile_id', 'business_description', 'platforms', 'tone', 'topics'],
    },
  },
  {
    name: 'check_connected_platforms',
    description: 'Check which platforms are already OAuth-connected for this profile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        profile_id: { type: 'string' },
      },
      required: ['profile_id'],
    },
  },
  {
    name: 'crawl_website',
    description: 'Crawl a business website URL to automatically extract business name, description, industry, location, services, and brand voice. Call this when the client shares their website URL instead of describing their business manually.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL of the business website (e.g. https://nustack.digital)' },
      },
      required: ['url'],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

interface ToolInput {
  name: string
  slug: string
  timezone: string
  industry: string
  profile_id: string
  tone: string
  topics: string[]
  hashtags: string[]
  cta_style?: string
  avoid?: string
  url: string
  platforms: Array<{
    platform: string
    posts_per_week: number
    preferred_days: string[]
    preferred_time: string
  }>
  business_description: string
}

async function runTool(
  name: string,
  input: Partial<ToolInput>,
  orgId: string,
  userId: string
): Promise<string> {
  switch (name) {
    case 'create_profile': {
      const { name: bname, slug, timezone, industry } = input as Pick<ToolInput, 'name' | 'slug' | 'timezone' | 'industry'>

      // Ensure unique slug
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      const finalSlug = existing
        ? `${slug}-${Date.now().toString(36)}`
        : slug

      const apiKey = generateApiKey()
      const apiKeyHash = hashApiKey(apiKey)

      const { data: profile, error } = await supabase
        .from('profiles')
        .insert({
          org_id: orgId,
          name: bname,
          slug: finalSlug,
          api_key_hash: apiKeyHash,
          timezone,
          webhook_url: null,
        })
        .select('id, name, slug')
        .single()

      if (error) return JSON.stringify({ error: error.message })

      // Store industry in metadata (separate table or json — store in profiles meta column if it exists, else skip gracefully)
      await supabase
        .from('profiles')
        .update({ webhook_url: null })
        .eq('id', profile.id)

      return JSON.stringify({
        success: true,
        profile_id: profile.id,
        name: profile.name,
        slug: profile.slug,
        industry,
        message: `Profile "${profile.name}" created (ID: ${profile.id})`,
      })
    }

    case 'set_tone_config': {
      const { profile_id, tone, topics, hashtags, cta_style, avoid } = input as Pick<ToolInput, 'profile_id' | 'tone' | 'topics' | 'hashtags' | 'cta_style' | 'avoid'>

      // Store in ai_drafts table meta or a dedicated config — use a sentinel ai_draft record as config storage
      const config = { tone, topics, hashtags, cta_style, avoid, configured_by: userId }

      const { error } = await supabase
        .from('ai_drafts')
        .insert({
          profile_id,
          prompt: '__tone_config__',
          generated: JSON.stringify(config),
          platforms: [],
          status: 'draft',
          approved_by: userId,
        })

      if (error) return JSON.stringify({ error: error.message })
      return JSON.stringify({ success: true, message: `Tone config saved: ${tone} voice, ${topics.length} topics, ${hashtags.length} hashtags` })
    }

    case 'set_schedule': {
      const { profile_id, platforms } = input as Pick<ToolInput, 'profile_id' | 'platforms'>

      // Store schedule as sentinel record
      const { error } = await supabase
        .from('ai_drafts')
        .insert({
          profile_id,
          prompt: '__schedule_config__',
          generated: JSON.stringify({ platforms, configured_by: userId }),
          platforms: platforms.map((p) => p.platform),
          status: 'draft',
          approved_by: userId,
        })

      if (error) return JSON.stringify({ error: error.message })

      const summary = platforms
        .map((p) => `${p.platform}: ${p.posts_per_week}x/week on ${p.preferred_days.join(', ')} at ${p.preferred_time}`)
        .join('; ')

      return JSON.stringify({ success: true, message: `Schedule saved: ${summary}` })
    }

    case 'generate_seed_posts': {
      const { profile_id, business_description, tone, topics } = input as Pick<ToolInput, 'profile_id' | 'business_description' | 'tone' | 'topics'>
      const plats = (input as unknown as { platforms: string[] }).platforms

      const seedPrompt = `Generate 5 diverse, ready-to-post social media posts for this business:

Business: ${business_description}
Tone: ${tone}
Key topics: ${topics.join(', ')}
Platforms: ${(plats as string[]).join(', ')}

Rules:
- Mix of topics (don't repeat the same angle)
- Each post optimized for its platform's character limits and style
- Include relevant emojis where appropriate
- No placeholders — write complete, publish-ready posts

Return ONLY valid JSON (no markdown):
{"posts": [{"platform": "linkedin", "content": "..."}, ...]}`

      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: seedPrompt }],
      })

      let posts: Array<{ platform: string; content: string }> = []
      try {
        const raw = (resp.content[0] as Anthropic.TextBlock).text
        const parsed = JSON.parse(raw) as { posts: Array<{ platform: string; content: string }> }
        posts = parsed.posts
      } catch {
        return JSON.stringify({ error: 'Failed to parse seed posts from AI' })
      }

      // Save each post as a draft
      const inserts = posts.map((p) => ({
        profile_id,
        prompt: business_description,
        generated: JSON.stringify([p]),
        platforms: [p.platform],
        status: 'draft' as const,
        approved_by: userId,
      }))

      const { error } = await supabase.from('ai_drafts').insert(inserts)
      if (error) return JSON.stringify({ error: error.message })

      return JSON.stringify({
        success: true,
        count: posts.length,
        message: `${posts.length} seed posts created as drafts. Preview them in AI Drafts.`,
        preview: posts[0]?.content?.slice(0, 100) + '…',
      })
    }

    case 'check_connected_platforms': {
      const { profile_id } = input as Pick<ToolInput, 'profile_id'>

      const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('platform, platform_username')
        .eq('profile_id', profile_id)

      const connected = tokens ?? []
      const all = ['twitter', 'linkedin', 'facebook', 'instagram', 'tiktok', 'pinterest', 'youtube', 'reddit', 'threads']
      const missing = all.filter((p) => !connected.find((t) => t.platform === p))

      return JSON.stringify({
        connected: connected.map((t) => `${t.platform} (@${t.platform_username ?? 'connected'})`),
        missing,
        message: connected.length === 0
          ? 'No platforms connected yet. Client will need to authorize each platform via OAuth.'
          : `${connected.length} platform(s) connected. ${missing.length} remaining.`,
      })
    }

    case 'crawl_website': {
      const { url } = input as Pick<ToolInput, 'url'>

      // Normalize URL
      const normalized = url.startsWith('http') ? url : `https://${url}`

      try {
        const result = await getFirecrawl().scrape(normalized, {
          formats: ['markdown'],
          onlyMainContent: true,
        })

        if (!result.markdown) {
          return JSON.stringify({ error: 'Could not scrape the website. It may be blocking crawlers.' })
        }

        // Truncate to avoid token overload — first 3000 chars is enough for business info
        const content = result.markdown.slice(0, 3000)

        return JSON.stringify({
          success: true,
          url: normalized,
          content,
          message: `Website scraped successfully. Use this content to infer business name, industry, location, services, and brand voice — then proceed with setup without asking the user to repeat any of it.`,
        })
      } catch {
        return JSON.stringify({ error: 'Website crawl failed. Ask the client to describe their business instead.' })
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM = `You are the Fanout Setup Agent — a friendly, efficient assistant that sets up a client's entire social media presence in one conversation.

Your job is to:
1. Gather info about their business (name, location, industry, goals)
2. Understand their posting goals (platforms, frequency, tone, topics)
3. Use your tools to autonomously create their profile, configure tone, set schedule, generate seed posts, and check platform connections
4. Give them a clear summary of what was set up and what still needs their action (OAuth connections)

Conversation style:
- Warm but efficient. One focused question at a time if you need info.
- Don't ask for info you can infer (e.g. if they say "dental office in Chicago", use America/Chicago timezone)
- Once you have enough info, ACT — don't ask for permission to use tools
- If the client shares a website URL, IMMEDIATELY call crawl_website — do not ask them to describe their business first
- After crawling, use the scraped content to fill in all business details automatically, then confirm with a brief summary
- Use tools in order: [crawl_website if URL given] → create_profile → set_tone_config → set_schedule → generate_seed_posts → check_connected_platforms
- After all tools run, give a clean summary with a checklist

Important:
- You are building for NuStack Digital Ventures' clients — small businesses, medical/dental practices, wellness studios, service businesses
- The Fanout platform will handle posting automatically once OAuth is connected
- Never mention competitor tools (Buffer, Hootsuite, etc.)
- If a client says they don't have developer app credentials, reassure them their agency (NuStack) handles that`

// ---------------------------------------------------------------------------
// POST handler — agentic loop
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const { messages } = parsed.data

  // Agentic loop — max 10 turns to prevent runaway
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const toolResults: string[] = []
  let finalText = ''
  let turns = 0

  while (turns < 10) {
    turns++

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      tools: TOOLS,
      messages: anthropicMessages,
    })

    // Collect text blocks
    const textBlocks = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    if (textBlocks) finalText = textBlocks

    // If no tool use, we're done
    if (response.stop_reason === 'end_turn') break

    // Process tool uses
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    if (toolUseBlocks.length === 0) break

    // Add assistant message with full content
    anthropicMessages.push({ role: 'assistant', content: response.content })

    // Run all tools and collect results
    const toolResultContents: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      const result = await runTool(toolUse.name, toolUse.input as Partial<ToolInput>, orgId, userId)
      toolResults.push(`[${toolUse.name}]: ${result}`)
      toolResultContents.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      })
    }

    // Add tool results message
    anthropicMessages.push({ role: 'user', content: toolResultContents })
  }

  return NextResponse.json({ reply: finalText, toolResults })
}
