import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

const FilterSchema = z.object({
  product: z.string().optional(),
  platform: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(100),
})

export async function GET(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = FilterSchema.safeParse(params)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })

  const { product, platform, status, limit } = parsed.data
  const supabase = getSupabase()

  let query = supabase
    .from('social_posts_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (product) query = query.eq('product', product)
  if (platform) query = query.eq('platform', platform)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const InsertSchema = z.object({
    product: z.string().min(1).max(100),
    platform: z.string().min(1),
    content: z.string().min(1).max(40000),
    image_url: z.string().url().optional(),
    scheduled_for: z.string().optional(),
  })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = InsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('social_posts_queue')
    .insert({ ...parsed.data, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}
