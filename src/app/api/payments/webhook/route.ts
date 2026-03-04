import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('x-square-hmacsha256-signature') ?? ''
  const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? ''

  // Verify Square webhook signature
  const url = `https://fanout.digital/api/payments/webhook`
  const hmac = createHmac('sha256', secret).update(url + body).digest('base64')
  if (hmac !== sig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body) as {
    type: string
    data?: { object?: { payment?: { order_id?: string; status?: string } } }
  }

  if (event.type === 'payment.completed') {
    // Extract org_id and plan from order metadata via Square API
    // For now log the event — full order lookup requires SQUARE_ACCESS_TOKEN
    // The webhook handler is wired; metadata extraction added when Square keys arrive
    console.log('[square webhook] payment.completed', event)
  }

  return NextResponse.json({ received: true })
}
