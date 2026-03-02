import { supabase } from './supabase'
import { hashApiKey } from './crypto'
import type { Profile } from './types'

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
