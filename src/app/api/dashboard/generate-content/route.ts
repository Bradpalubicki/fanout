export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

/**
 * Server-side proxy for /api/generate-social-content.
 * Adds INTERNAL_API_KEY on the server — key never reaches the browser.
 * Dashboard clients call this route; they do not send any auth key themselves.
 *
 * Because this route lends a privileged credential, it must constrain WHAT
 * that credential is used for. It previously forwarded the caller's body
 * verbatim, so any authenticated dashboard user could shape an
 * INTERNAL_API_KEY-authorized request — a confused deputy. That the upstream
 * validates shape is not sufficient: the upstream trusts the key, and the key
 * is what this route is handing over.
 *
 * This mirrors the upstream contract (generate-social-content/route.ts) so a
 * body is vetted HERE, before the key is attached. `.strict()` refuses unknown
 * keys rather than passing them upstream, so a field added to the upstream
 * schema must be added here deliberately rather than becoming reachable by
 * default.
 */
const ProxySchema = z
  .object({
    product: z.enum(['certusaudit', 'pocketpals', 'sitegrade', 'wellness-engine']),
    platform: z.string().min(1).max(50),
    topic: z.string().max(500).optional(),
    queue: z.boolean().optional(),
    scheduled_for: z.string().datetime().optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ProxySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  // Forward the PARSED value, never the raw body. While .strict() is in place
  // these are equivalent — an unknown key is rejected above, so nothing
  // unvetted can reach here — and no test can tell the two apart. It is kept
  // deliberately: if .strict() is ever relaxed to .passthrough() or dropped,
  // forwarding `raw` would silently restore the confused deputy, whereas this
  // line keeps the forwarded body confined to the declared contract.
  const body = parsed.data

  const internalKey = process.env.INTERNAL_API_KEY
  if (!internalKey) {
    return NextResponse.json({ error: 'Internal key not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fanout.digital'
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
