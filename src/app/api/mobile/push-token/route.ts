export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

const PushTokenSchema = z.object({
  token: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, orgId } = user

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PushTokenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { token } = parsed.data

  const { error } = await supabase
    .from('mobile_push_tokens')
    .upsert(
      { user_id: userId, org_id: orgId, token, platform: 'expo', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to register push token' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
