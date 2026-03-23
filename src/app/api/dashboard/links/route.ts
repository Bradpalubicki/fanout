export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

function randomCode(len = 6): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET(_req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: links } = await supabase
    .from('short_links')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ links: links ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const schema = z.object({
    targetUrl: z.string().url(),
    title: z.string().optional(),
    customCode: z.string().min(2).max(30).regex(/^[a-z0-9-_]+$/).optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { targetUrl, title, customCode } = parsed.data
  const code = customCode ?? randomCode()

  // Check uniqueness
  const { data: existing } = await supabase.from('short_links').select('id').eq('code', code).single()
  if (existing) return NextResponse.json({ error: 'Code already taken' }, { status: 409 })

  const { data, error } = await supabase
    .from('short_links')
    .insert({ org_id: orgId, code, target_url: targetUrl, title: title ?? targetUrl, clicks_total: 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
  return NextResponse.json({ link: data })
}

export async function DELETE(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: link } = await supabase.from('short_links').select('org_id').eq('id', id).single()
  if (!link || link.org_id !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('short_links').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
