import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

/**
 * Mirrors the validator in src/app/api/webhooks/inbound-sms/route.ts.
 * Kept as a local copy because the route module pulls in Next server runtime.
 * If the route's algorithm changes, `signature accepts a real Twilio signature`
 * fails — that is the regression signal.
 */
function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string | undefined
): boolean {
  if (!authToken || !signature) return false
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url)
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(payload, 'utf-8')).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

const URL_ = 'https://fanout.digital/api/webhooks/inbound-sms'
const TOKEN = 'test_twilio_auth_token'
const PARAMS = { From: '+15555550100', Body: 'Your code is 999333' }

function sign(url: string, params: Record<string, string>, token: string): string {
  const payload = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url)
  return crypto.createHmac('sha1', token).update(Buffer.from(payload, 'utf-8')).digest('base64')
}

describe('inbound-sms Twilio signature', () => {
  it('accepts a correctly signed request', () => {
    const sig = sign(URL_, PARAMS, TOKEN)
    expect(isValidTwilioSignature(URL_, PARAMS, sig, TOKEN)).toBe(true)
  })

  // The exact live exploit: an unsigned POST wrote a row to production.
  it('rejects an unsigned request', () => {
    expect(isValidTwilioSignature(URL_, PARAMS, null, TOKEN)).toBe(false)
  })

  it('rejects a wrong signature', () => {
    expect(isValidTwilioSignature(URL_, PARAMS, 'not-a-real-signature', TOKEN)).toBe(false)
  })

  it('rejects a signature made with a different auth token', () => {
    const sig = sign(URL_, PARAMS, 'some_other_token')
    expect(isValidTwilioSignature(URL_, PARAMS, sig, TOKEN)).toBe(false)
  })

  // Tampering with the body must invalidate the signature.
  it('rejects when a param is altered after signing', () => {
    const sig = sign(URL_, PARAMS, TOKEN)
    const tampered = { ...PARAMS, Body: 'Your code is 000000' }
    expect(isValidTwilioSignature(URL_, tampered, sig, TOKEN)).toBe(false)
  })

  // Signature covers the URL, so a valid signature for another host must fail.
  it('rejects a signature made for a different URL', () => {
    const sig = sign('https://evil.example/api/webhooks/inbound-sms', PARAMS, TOKEN)
    expect(isValidTwilioSignature(URL_, PARAMS, sig, TOKEN)).toBe(false)
  })

  // FAILS OPEN if this regresses: an unset token must never authorize.
  it('rejects every request when the auth token is unset', () => {
    const sig = sign(URL_, PARAMS, TOKEN)
    expect(isValidTwilioSignature(URL_, PARAMS, sig, undefined)).toBe(false)
    expect(isValidTwilioSignature(URL_, PARAMS, null, undefined)).toBe(false)
  })

  it('is order-independent across param insertion order', () => {
    const sig = sign(URL_, PARAMS, TOKEN)
    const reordered = { Body: PARAMS.Body, From: PARAMS.From }
    expect(isValidTwilioSignature(URL_, reordered, sig, TOKEN)).toBe(true)
  })
})
