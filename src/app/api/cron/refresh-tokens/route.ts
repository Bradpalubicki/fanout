import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest'

export async function GET() {
  await inngest.send({
    name: 'social/tokens.check' as const,
    data: {},
  })

  return NextResponse.json({ triggered: true })
}
