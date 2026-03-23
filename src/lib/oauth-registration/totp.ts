import { authenticator, totp } from 'otplib'

export async function generateTotpCode(secret: string): Promise<string> {
  return totp.generate(secret)
}

export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  try {
    return totp.verify({ token, secret })
  } catch {
    return false
  }
}

export function generateTotpSecret(accountName: string, issuer: string = 'Fanout'): {
  secret: string
  otpauthUrl: string
} {
  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(accountName, issuer, secret)
  return { secret, otpauthUrl }
}
