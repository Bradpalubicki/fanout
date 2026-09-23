import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { inngest } from '@/lib/inngest'

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  await inngest.send({
    name: 'social/tokens.check' as const,
    data: {},
  })

  return NextResponse.json({ triggered: true })
}
