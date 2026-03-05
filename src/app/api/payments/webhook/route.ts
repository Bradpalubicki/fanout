import { NextRequest, NextResponse } from 'next/server'
import { WebhooksHelper } from 'square'
import { squareClient } from '@/lib/square'
import { upsertActiveSubscription, type PlanKey } from '@/lib/subscriptions'

const WEBHOOK_URL = 'https://fanout.digital/api/payments/webhook'

const VALID_PLAN_KEYS = new Set<string>(['starter', 'agency', 'white-label'])

function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && VALID_PLAN_KEYS.has(value)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signatureHeader = req.headers.get('x-square-hmacsha256-signature') ?? ''
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? ''

  const isValid = await WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader,
    signatureKey,
    notificationUrl: WEBHOOK_URL,
  })

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: unknown
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof event !== 'object' ||
    event === null ||
    (event as Record<string, unknown>).type !== 'payment.completed'
  ) {
    return NextResponse.json({ received: true })
  }

  const typedEvent = event as Record<string, unknown>
  const paymentData = (typedEvent.data as Record<string, unknown> | undefined)
    ?.object as Record<string, unknown> | undefined
  const payment = paymentData?.payment as Record<string, unknown> | undefined
  const orderId = payment?.order_id

  if (typeof orderId !== 'string' || !orderId) {
    return NextResponse.json({ received: true, note: 'no order_id' })
  }

  // Fetch order to get metadata (org_id, plan)
  try {
    const orderResponse = await squareClient.orders.get({ orderId })
    const order = orderResponse.order
    const metadata = order?.metadata as Record<string, string> | undefined
    const orgId = metadata?.org_id
    const plan = metadata?.plan

    if (!orgId || !isPlanKey(plan)) {
      return NextResponse.json({ received: true, note: 'missing or invalid metadata' })
    }

    await upsertActiveSubscription(orgId, plan, orderId)
  } catch {
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
