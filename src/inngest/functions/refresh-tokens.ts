import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import { decryptToken, encryptToken } from '@/lib/crypto'
import { DISTRIBUTORS } from '@/lib/fan-out'

export const refreshExpiringTokens = inngest.createFunction(
  { id: 'refresh-expiring-tokens' },
  { cron: '0 */4 * * *' }, // Every 4 hours
  async ({ step }) => {
    const expiringTokens = await step.run('find-expiring-tokens', async () => {
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('oauth_tokens')
        .select('id, profile_id, platform, refresh_token, expires_at')
        .lt('expires_at', cutoff)
        .not('refresh_token', 'is', null)
      return data ?? []
    })

    if (!expiringTokens.length) return { refreshed: 0 }

    const events = expiringTokens.map((t) => ({
      name: 'social/token.refresh' as const,
      data: { tokenId: t.id, profileId: t.profile_id, platform: t.platform },
    }))

    await step.sendEvent('fan-out-token-refreshes', events)
    return { queued: expiringTokens.length }
  }
)

export const refreshSingleToken = inngest.createFunction(
  { id: 'refresh-single-token', retries: 2 },
  { event: 'social/token.refresh' },
  async ({ event, step }) => {
    const { tokenId, profileId, platform } = event.data as {
      tokenId: string
      profileId: string
      platform: string
    }

    await step.run('refresh-token', async () => {
      const { data: token } = await supabase
        .from('oauth_tokens')
        .select('refresh_token')
        .eq('id', tokenId)
        .single()

      if (!token?.refresh_token) throw new Error('No refresh token found')

      const distributor = DISTRIBUTORS[platform]
      if (!distributor) throw new Error(`No distributor for ${platform}`)

      const decryptedRefresh = await decryptToken(token.refresh_token)
      const newTokens = await distributor.refreshToken(decryptedRefresh)

      const encryptedAccess = await encryptToken(newTokens.accessToken)
      const encryptedRefresh = newTokens.refreshToken
        ? await encryptToken(newTokens.refreshToken)
        : undefined

      const updateData: Record<string, unknown> = {
        access_token: encryptedAccess,
        expires_at: newTokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (encryptedRefresh) updateData.refresh_token = encryptedRefresh

      await supabase.from('oauth_tokens').update(updateData).eq('id', tokenId)

      await supabase.from('oauth_audit_log').insert({
        profile_id: profileId,
        platform,
        action: 'refresh',
        success: true,
      })
    })

    return { tokenId, platform, refreshed: true }
  }
)
