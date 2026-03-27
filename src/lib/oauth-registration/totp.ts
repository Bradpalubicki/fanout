// Use require-style import to force CJS resolution — Turbopack ESM build
// doesn't export named 'authenticator'/'totp' but CJS index.js does
// eslint-disable-next-line @typescript-eslint/no-require-imports
const otplib = require('otplib') as {
  totp: {
    generate(secret: string): string
    verify(opts: { token: string; secret: string }): boolean
  }
  authenticator: {
    generateSecret(): string
    keyuri(account: string, issuer: string, secret: string): string
  }
}

export async function generateTotpCode(secret: string): Promise<string> {
  return otplib.totp.generate(secret)
}

export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  try {
    return otplib.totp.verify({ token, secret })
  } catch {
    return false
  }
}

export function generateTotpSecret(accountName: string, issuer: string = 'Fanout'): {
  secret: string
  otpauthUrl: string
} {
  const secret = otplib.authenticator.generateSecret()
  const otpauthUrl = otplib.authenticator.keyuri(accountName, issuer, secret)
  return { secret, otpauthUrl }
}
