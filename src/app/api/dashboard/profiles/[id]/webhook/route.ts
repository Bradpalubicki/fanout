import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const Schema = z.object({
  webhookUrl: z.string().url().optional().or(z.literal('')),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ webhook_url: parsed.data.webhookUrl || null })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
