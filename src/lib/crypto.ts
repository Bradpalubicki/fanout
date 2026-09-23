import { createHash, randomBytes } from 'crypto'
import { supabase } from './supabase'

export function generateApiKey(): string {
  return randomBytes(32).toString('hex')
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function encryptToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('encrypt_token', {
    raw_token: token,
    encryption_key: process.env.TOKEN_ENCRYPTION_KEY!,
  })
  if (error) throw new Error(`Encryption failed: ${error.message}`)
  return data as string
}

/**
 * Thrown when a stored ciphertext cannot be decrypted with the current key.
 * The row is permanently unusable — retrying will never succeed — so callers
 * should skip it and log, never retry.
 */
export class TokenCorruptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenCorruptError'
  }
}

/**
 * Thrown when decryption could not be attempted or completed for a reason
 * unrelated to the ciphertext — network blip, RPC timeout, Supabase 5xx.
 * The credential is presumed fine; callers MUST propagate this so the caller's
 * retry mechanism runs. Swallowing it silently discards a valid credential.
 */
export class TokenDecryptUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenDecryptUnavailableError'
  }
}

/**
 * Postgres error codes that mean "this ciphertext is bad", as opposed to
 * "the database could not answer right now". pgcrypto raises 39000 (external
 * routine invocation) / 22023 (invalid parameter) on a wrong key or corrupt
 * input; 22P02 is a malformed bytea literal.
 */
const CORRUPT_PG_CODES = new Set(['22023', '22P02', '39000', '39P01'])

function isCorruptCiphertext(error: { code?: string; message?: string }): boolean {
  if (error.code && CORRUPT_PG_CODES.has(error.code)) return true
  const m = (error.message ?? '').toLowerCase()
  return (
    m.includes('wrong key') ||
    m.includes('decryption_failed') ||
    m.includes('invalid input syntax') ||
    m.includes('corrupt')
  )
}

export async function decryptToken(encryptedToken: string): Promise<string> {
  let data: unknown
  let error: { code?: string; message?: string } | null

  try {
    ;({ data, error } = await supabase.rpc('decrypt_token', {
      encrypted_token: encryptedToken,
      encryption_key: process.env.TOKEN_ENCRYPTION_KEY!,
    }))
  } catch (e) {
    // The RPC call itself threw (network failure, abort, DNS). Never a
    // statement about the ciphertext.
    throw new TokenDecryptUnavailableError(
      `Decryption unavailable: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  if (error) {
    if (isCorruptCiphertext(error)) {
      throw new TokenCorruptError(`Decryption failed: ${error.message}`)
    }
    throw new TokenDecryptUnavailableError(`Decryption unavailable: ${error.message}`)
  }

  // A null/empty result with no error means pgcrypto returned nothing for this
  // input — treat as corrupt rather than handing an empty credential onward.
  if (typeof data !== 'string' || data.length === 0) {
    throw new TokenCorruptError('Decryption returned an empty token')
  }

  return data
}

export function generateStateToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Generate a PKCE code verifier (43–128 chars, URL-safe, RFC 7636 §4.1).
 * Twitter/X OAuth 2.0 requires this for the PKCE flow.
 */
export function generatePkceVerifier(): string {
  return randomBytes(48).toString('base64url')
}
