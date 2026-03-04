import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest'

export async function GET() {
  await inngest.send({
    name: 'social/analytics.collect' as const,
    data: {},
  })

  return NextResponse.json({ triggered: true })
}
