import { supabase } from './supabase'
import { hashApiKey } from './crypto'
import type { Profile } from './types'

/**
 * Verifies that the request carries a valid INTERNAL_API_KEY.
 * Used to auth-gate NuStack-internal machine-to-machine routes (e.g. /api/fanout/*).
 * Returns null on success, or a { error, status } object on failure.
 */
export function verifyInternalKey(
  authHeader: string | null
): { error: string; status: number } | null {
  const internalKey = process.env.INTERNAL_API_KEY
  if (!internalKey) {
    return { error: 'Internal key not configured', status: 500 }
  }
  if (authHeader !== `Bearer ${internalKey}`) {
    return { error: 'Unauthorized', status: 401 }
  }
  return null
}

export async function verifyApiKey(
  authHeader: string | null
): Promise<{ profile: Profile } | { error: string; status: number }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 }
  }

  const apiKey = authHeader.slice(7)
  const keyHash = hashApiKey(apiKey)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('api_key_hash', keyHash)
    .single()

  if (error || !profile) {
    return { error: 'Invalid API key', status: 401 }
  }

  return { profile: profile as Profile }
}
