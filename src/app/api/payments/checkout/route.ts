import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { squareClient, PLANS, type PlanKey } from '@/lib/square'
import { randomUUID } from 'crypto'

const Schema = z.object({
  plan: z.enum(['starter', 'agency', 'white-label']),
})

export async function POST(req: NextRequest) {
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

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const plan = PLANS[parsed.data.plan as PlanKey]
  const origin = req.headers.get('origin') ?? 'https://fanout.digital'

  const response = await squareClient.checkout.paymentLinks.create({
    idempotencyKey: randomUUID(),
    order: {
      locationId: plan.locationId,
      lineItems: [
        {
          name: `Fanout ${plan.name} Plan`,
          quantity: '1',
          basePriceMoney: {
            amount: BigInt(plan.price),
            currency: 'USD',
          },
        },
      ],
      metadata: {
        org_id: orgId,
        user_id: userId,
        plan: parsed.data.plan,
      },
    },
    checkoutOptions: {
      redirectUrl: `${origin}/dashboard/settings?tab=billing&checkout=success`,
    },
  })

  const url = response.paymentLink?.url
  if (!url) {
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
