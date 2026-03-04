import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await inngest.send({
    name: 'social/analytics.collect' as const,
    data: {},
  })

  return NextResponse.json({ triggered: true })
}
