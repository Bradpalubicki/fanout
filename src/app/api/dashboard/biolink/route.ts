export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const linkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  icon: z.string().optional(),
})

const pageSchema = z.object({
  handle: z.string().min(2).max(30).regex(/^[a-z0-9-_]+$/),
  title: z.string().min(1),
  bio: z.string().max(300).optional(),
  avatar_url: z.string().url().optional(),
  background_color: z.string().optional(),
  button_style: z.enum(['rounded', 'pill', 'square']).optional(),
  links: z.array(linkSchema),
  is_published: z.boolean().optional(),
  profile_id: z.string(),
})

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profiles } = await supabase.from('profiles').select('id').eq('org_id', orgId)
  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ pages: [] })

  const { data: pages } = await supabase
    .from('biolink_pages')
    .select('*')
    .in('profile_id', profileIds)
    .order('created_at', { ascending: false })

  // If a specific page is requested, return per-link click counts
  const pageId = req.nextUrl.searchParams.get('clicksFor')
  if (pageId) {
    const { data: clicks } = await supabase
      .from('biolink_clicks')
      .select('link_index')
      .eq('page_id', pageId)

    const linkClicks: Record<number, number> = {}
    for (const c of clicks ?? []) {
      const idx = c.link_index as number
      linkClicks[idx] = (linkClicks[idx] ?? 0) + 1
    }
    return NextResponse.json({ pages: pages ?? [], linkClicks })
  }

  return NextResponse.json({ pages: pages ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = pageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('id', parsed.data.profile_id).eq('org_id', orgId).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Check handle uniqueness
  const { data: existing } = await supabase.from('biolink_pages').select('id').eq('handle', parsed.data.handle).single()
  if (existing) return NextResponse.json({ error: 'Handle already taken' }, { status: 409 })

  const { data, error } = await supabase
    .from('biolink_pages')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create page' }, { status: 500 })
  return NextResponse.json({ page: data })
}

export async function PATCH(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...rest } = body as { id: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Verify ownership
  const { data: page } = await supabase
    .from('biolink_pages')
    .select('id, profiles!inner(org_id)')
    .eq('id', id).single()

  if (!page || (page.profiles as unknown as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase.from('biolink_pages').update(rest).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ page: data })
}
