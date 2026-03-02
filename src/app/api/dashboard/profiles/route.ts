import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { generateApiKey, hashApiKey } from '@/lib/crypto'

const CreateProfileSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  timezone: z.string().default('UTC'),
})

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, slug, webhookUrl, timezone } = parsed.data

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
  }

  const apiKey = generateApiKey()
  const apiKeyHash = hashApiKey(apiKey)

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      org_id: orgId,
      name,
      slug,
      api_key_hash: apiKeyHash,
      webhook_url: webhookUrl || null,
      timezone,
    })
    .select()
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  return NextResponse.json({ profile, apiKey }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, oauth_tokens(platform, platform_username, expires_at)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ profiles: profiles ?? [] })
}
