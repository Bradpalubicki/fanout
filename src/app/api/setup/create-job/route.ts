export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const schema = z.object({
  businessInfo: z.object({
    name: z.string(),
    website: z.string().optional(),
    category: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  }),
  brandData: z.record(z.string(), z.unknown()).nullable(),
  platforms: z.array(z.string()),
  platformBios: z.array(z.object({
    platform: z.string(),
    displayName: z.string(),
    bio: z.string(),
    hashtags: z.array(z.string()),
  })).optional(),
})

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

  const { businessInfo, brandData, platforms, platformBios } = parsed.data

  // Create or get a profile for this org
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)
    .single()

  let profileId = existingProfile?.id

  if (!profileId) {
    const slug = businessInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        org_id: orgId,
        name: businessInfo.name,
        slug: `${slug}-${Date.now()}`,
        timezone: 'America/Chicago',
      })
      .select('id')
      .single()
    profileId = newProfile?.id
  }

  if (!profileId) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  // Create setup_jobs record
  const { data: job, error } = await supabase
    .from('setup_jobs')
    .insert({
      org_id: orgId,
      status: 'in_progress',
      step: 5,
      business_info: businessInfo,
      brand_data: brandData,
      platform_statuses: Object.fromEntries(platforms.map((p) => [p, 'queued'])),
    })
    .select('id')
    .single()

  if (error) {
    // setup_jobs table may not exist yet — proceed without it
    return NextResponse.json({ jobId: null, profileId })
  }

  // Trigger 30-day calendar generation
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://fanout.digital'}/api/setup/generate-calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandData,
      platforms,
      orgId,
      profileId,
      platformBios,
      businessInfo,
    }),
  }).catch(() => { /* fire and forget */ })

  return NextResponse.json({ jobId: job.id, profileId })
}
