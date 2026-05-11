import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyInternalKey } from '@/lib/auth'
import { inngest } from '@/lib/inngest'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  orgId: z.string().min(1),
  platform: z.enum(['bluesky', 'pinterest', 'twitter']),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
})

export async function POST(req: NextRequest) {
  const authError = verifyInternalKey(req.headers.get('authorization'))
  if (authError) {
    return NextResponse.json({ error: authError.error }, { status: authError.status })
  }

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
  }

  await inngest.send({
    name: 'fanout/account.create',
    data: parsed.data,
  })

  return NextResponse.json({ queued: true, platform: parsed.data.platform, orgId: parsed.data.orgId })
}
