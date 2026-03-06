import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Platform detection from sender number
const PLATFORM_NUMBERS: Record<string, string> = {
  // Twitter SMS codes come from short codes
  '40404': 'twitter',
  '89361': 'twitter',
  // Reddit
  '25733': 'reddit',
  // Google
  '22000': 'youtube',
  '777': 'youtube',
  // LinkedIn
  '58249': 'linkedin',
  '26625': 'linkedin',
}

function detectPlatformFromSender(from: string): string {
  const short = from.replace(/\D/g, '').slice(-5)
  return PLATFORM_NUMBERS[short] ?? PLATFORM_NUMBERS[from.replace(/\D/g, '')] ?? 'unknown'
}

function extractCode(body: string): string | null {
  // Match 6-digit codes, 4-digit codes, or alphanumeric codes
  const patterns = [
    /\b(\d{6})\b/,
    /\b(\d{4})\b/,
    /code[:\s]+([A-Z0-9]{6,8})/i,
    /verification code[:\s]+([A-Z0-9]{4,8})/i,
    /your code is[:\s]+([A-Z0-9]{4,8})/i,
  ]
  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  // Twilio sends form data
  const formData = await req.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string

  if (!from || !body) {
    return new NextResponse('<?xml version="1.0"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  const platform = detectPlatformFromSender(from)
  const code = extractCode(body)

  if (code) {
    await supabase.from('two_factor_codes').insert({
      platform,
      channel: 'sms',
      code,
      raw_message: body,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
  }

  // Return empty TwiML response
  return new NextResponse('<?xml version="1.0"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
