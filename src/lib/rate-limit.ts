import { supabase } from './supabase'

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 100

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

/**
 * Sliding window rate limiter using Supabase.
 * 100 requests per minute per profile_id.
 */
export async function checkRateLimit(profileId: string): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
  const resetAt = new Date(Date.now() + WINDOW_MS)

  // Count requests in current window
  const { count } = await supabase
    .from('api_rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('created_at', windowStart)

  const current = count ?? 0
  const remaining = Math.max(0, MAX_REQUESTS - current)

  if (current >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt }
  }

  // Log this request
  await supabase.from('api_rate_limit_log').insert({
    profile_id: profileId,
    created_at: new Date().toISOString(),
  })

  return { allowed: true, remaining: remaining - 1, resetAt }
}
