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

export async function decryptToken(encryptedToken: string): Promise<string> {
  const { data, error } = await supabase.rpc('decrypt_token', {
    encrypted_token: encryptedToken,
    encryption_key: process.env.TOKEN_ENCRYPTION_KEY!,
  })
  if (error) throw new Error(`Decryption failed: ${error.message}`)
  return data as string
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
