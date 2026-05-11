export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * Server-side proxy for /api/generate-social-content.
 * Adds INTERNAL_API_KEY on the server — key never reaches the browser.
 * Dashboard clients call this route; they do not send any auth key themselves.
 */
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

  const internalKey = process.env.INTERNAL_API_KEY
  if (!internalKey) {
    return NextResponse.json({ error: 'Internal key not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fanout.digital'
  const upstream = await fetch(`${appUrl}/api/generate-social-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${internalKey}`,
    },
    body: JSON.stringify(body),
  })

  const data: unknown = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
