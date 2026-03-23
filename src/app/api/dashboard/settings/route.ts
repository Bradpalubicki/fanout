export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { getOrCreateOrgSubscription } from '@/lib/subscriptions'

const UpdateSettingsSchema = z.object({
  defaultTimezone: z.string().min(1).max(100),
})

export async function PATCH(req: NextRequest) {
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

  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Ensure org subscription exists
  const sub = await getOrCreateOrgSubscription(orgId)

  const { error } = await supabase
    .from('org_subscriptions')
    .update({ default_timezone: parsed.data.defaultTimezone })
    .eq('org_id', orgId)
    .eq('id', sub.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(_req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sub = await getOrCreateOrgSubscription(orgId)

  return NextResponse.json({
    defaultTimezone: (sub as unknown as { default_timezone: string }).default_timezone ?? 'UTC',
    plan: sub.plan_key,
    status: sub.status,
    trialExpiresAt: sub.trial_expires_at,
  })
}
