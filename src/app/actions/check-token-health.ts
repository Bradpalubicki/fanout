'use server'

import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export interface TokenHealth {
  platform: string
  status: 'healthy' | 'expiring_soon' | 'expired'
  expiresAt: string | null
  daysLeft: number | null
}

export async function checkTokenHealth(profileId: string): Promise<TokenHealth[]> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return []

  // Verify profile belongs to caller's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()
  if (!profile) return []

  const { data: tokens, error } = await supabase
    .from('oauth_tokens')
    .select('platform, expires_at')
    .eq('profile_id', profileId)

  if (error || !tokens) return []

  const now = new Date()
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  return tokens.map((t) => {
    if (!t.expires_at) {
      return {
        platform: t.platform,
        status: 'healthy' as const,
        expiresAt: null,
        daysLeft: null,
      }
    }

    const expiresAt = new Date(t.expires_at)
    const diff = expiresAt.getTime() - now.getTime()
    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))

    let status: TokenHealth['status'] = 'healthy'
    if (diff < 0) {
      status = 'expired'
    } else if (diff < sevenDays) {
      status = 'expiring_soon'
    }

    return {
      platform: t.platform,
      status,
      expiresAt: t.expires_at,
      daysLeft: diff < 0 ? 0 : daysLeft,
    }
  })
}
