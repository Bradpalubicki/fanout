import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Detect platform from email sender domain
function detectPlatformFromEmail(from: string): string {
  const domain = from.toLowerCase()
  if (domain.includes('twitter') || domain.includes('x.com')) return 'twitter'
  if (domain.includes('linkedin')) return 'linkedin'
  if (domain.includes('reddit')) return 'reddit'
  if (domain.includes('google') || domain.includes('youtube')) return 'youtube'
  if (domain.includes('pinterest')) return 'pinterest'
  if (domain.includes('tiktok')) return 'tiktok'
  if (domain.includes('facebook') || domain.includes('meta')) return 'facebook'
  if (domain.includes('instagram')) return 'instagram'
  return 'unknown'
}

function extractCode(text: string): string | null {
  const patterns = [
    /\b(\d{6})\b/,
    /\b(\d{4})\b/,
    /verification code[:\s]+([A-Z0-9]{4,8})/i,
    /your code[:\s]+([A-Z0-9]{4,8})/i,
    /code is[:\s]+([A-Z0-9]{4,8})/i,
    /one.time.code[:\s]+([A-Z0-9]{4,8})/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Cloudflare Email Routing forwards emails as HTTP POST to this webhook
// Payload format: { from, to, subject, text, html }
export async function POST(req: NextRequest) {
  // Verify this is from our internal routing (Cloudflare adds a secret header)
  const routingSecret = req.headers.get('x-email-routing-secret')
  if (routingSecret !== process.env.EMAIL_ROUTING_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const emailSchema = z.object({
    from: z.string(),
    to: z.string().optional(),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
  })
  const parsed = emailSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ ok: true }) // silently accept malformed

  const { from, subject, text = '', html = '' } = parsed.data
  const bodyText = text || html.replace(/<[^>]+>/g, ' ')

  const platform = detectPlatformFromEmail(from)
  const code = extractCode(subject + ' ' + bodyText)

  if (code) {
    await supabase.from('two_factor_codes').insert({
      platform,
      channel: 'email',
      code,
      raw_message: `From: ${from}\nSubject: ${subject}\n\n${bodyText.slice(0, 500)}`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
  }

  return NextResponse.json({ ok: true })
}
