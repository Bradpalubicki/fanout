export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const PLATFORM_NUMBERS: Record<string, string> = {
  '40404': 'twitter', '89361': 'twitter',
  '25733': 'reddit',
  '22000': 'youtube', '777': 'youtube',
  '58249': 'linkedin', '26625': 'linkedin',
}

const TWIML_EMPTY = '<?xml version="1.0"?><Response></Response>'
const xml = (status = 200) =>
  new NextResponse(TWIML_EMPTY, { status, headers: { 'Content-Type': 'text/xml' } })

/**
 * Validate Twilio's X-Twilio-Signature.
 * Twilio signs: the full request URL, then every POST param appended as
 * key+value in lexicographic key order, HMAC-SHA1'd with the account auth
 * token and base64-encoded. See Twilio "Validating Requests".
 *
 * Returns false when TWILIO_AUTH_TOKEN is unset — an unconfigured secret must
 * fail CLOSED, never authorize. (cf. lib/auth.ts verifyInternalKey)
 */
function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken || !signature) return false

  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url)

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(payload, 'utf-8'))
    .digest('base64')

  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function detectPlatformFromSender(from: string): string {
  const short = from.replace(/\D/g, '').slice(-5)
  return PLATFORM_NUMBERS[short] ?? PLATFORM_NUMBERS[from.replace(/\D/g, '')] ?? 'unknown'
}

function extractCode(body: string): string | null {
  const patterns = [/\b(\d{6})\b/, /\b(\d{4})\b/, /code[:\s]+([A-Z0-9]{6,8})/i, /verification code[:\s]+([A-Z0-9]{4,8})/i, /your code is[:\s]+([A-Z0-9]{4,8})/i]
  for (const pattern of patterns) { const match = body.match(pattern); if (match) return match[1] }
  return null
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  // Collect params before any side effect — they are part of the signature.
  const params: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') params[key] = value
  }

  // TWILIO_WEBHOOK_URL pins the signed URL. Deriving it from req.url signs
  // whatever host a caller presents, and this app also serves www -> apex
  // redirects, so the proxied URL may differ from the one Twilio signed.
  const signedUrl = process.env.TWILIO_WEBHOOK_URL ?? req.url
  if (!isValidTwilioSignature(signedUrl, params, req.headers.get('x-twilio-signature'))) {
    return xml(403)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const from = params.From
  const body = params.Body
  if (!from || !body) return xml()
  const platform = detectPlatformFromSender(from)
  const code = extractCode(body)
  if (code) await supabase.from('two_factor_codes').insert({ platform, channel: 'sms', code, raw_message: body, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
  return xml()
}
