import { generate, verify, generateSecret, generateURI } from 'otplib'

/**
 * Generate a TOTP code from a stored base32 secret.
 * Returns a promise — otplib v13 generate() is async.
 */
export async function generateTotpCode(secret: string): Promise<string> {
  return generate({ secret })
}

/**
 * Verify a TOTP code against a secret.
 */
export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret })
    // VerifyResult is an object — check .valid property or truthy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any
    return r === true || r?.valid === true || !!r
  } catch {
    return false
  }
}

/**
 * Generate a new TOTP secret + QR code URI for enrolling a new account.
 */
export function generateTotpSecret(accountName: string, issuer: string = 'Fanout'): {
  secret: string
  otpauthUrl: string
} {
  const secret = generateSecret({ length: 20 })
  const otpauthUrl = generateURI({ secret, label: accountName, issuer, algorithm: 'sha1', digits: 6, period: 30 })
  return { secret, otpauthUrl }
}
