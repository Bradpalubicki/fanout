export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { decryptToken, encryptToken } from '@/lib/crypto'
import { z } from 'zod'

const BodySchema = z.object({
  profileId: z.string().uuid(),
  platform: z.enum(['facebook', 'instagram', 'threads']),
  pageId: z.string().min(1),
  pageName: z.string().optional(),
})

// GET: fetch available pages/accounts for a Meta platform
export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')
  const platform = searchParams.get('platform') as 'facebook' | 'instagram' | 'threads' | null

  if (!profileId || !platform) {
    return NextResponse.json({ error: 'profileId and platform required' }, { status: 400 })
  }

  // Verify profile belongs to the caller's org
  const { data: profileCheck } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()
  if (!profileCheck) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Get the stored user token
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('profile_id', profileId)
    .eq('platform', platform)
    .single()

  if (!tokenRow) {
    return NextResponse.json({ error: 'Token not found — reconnect the platform' }, { status: 404 })
  }

  const userToken = await decryptToken(tokenRow.access_token as string)

  try {
    if (platform === 'facebook') {
      // Fetch pages the user manages
      const res = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${userToken}`
      )
      const data = await res.json() as {
        data?: { id: string; name: string; access_token: string; picture?: { data: { url: string } } }[]
        error?: { message: string }
      }
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to fetch pages')
      return NextResponse.json({ pages: data.data ?? [] })
    }

    if (platform === 'instagram') {
      // Fetch FB pages first, then get linked IG business accounts
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account&access_token=${userToken}`
      )
      const pagesData = await pagesRes.json() as {
        data?: { id: string; name: string; instagram_business_account?: { id: string } }[]
      }

      const igAccounts: { id: string; name: string; pageId: string; pageName: string }[] = []
      for (const page of (pagesData.data ?? [])) {
        if (page.instagram_business_account?.id) {
          const igRes = await fetch(
            `https://graph.facebook.com/v19.0/${page.instagram_business_account.id}?fields=id,username,profile_picture_url&access_token=${userToken}`
          )
          const igData = await igRes.json() as { id: string; username?: string }
          igAccounts.push({
            id: igData.id,
            name: `@${igData.username ?? igData.id}`,
            pageId: page.id,
            pageName: page.name,
          })
        }
      }
      return NextResponse.json({ pages: igAccounts })
    }

    if (platform === 'threads') {
      // Fetch Threads user profile
      const res = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${userToken}`
      )
      const data = await res.json() as { id?: string; username?: string; error?: { message: string } }
      if (!res.ok || !data.id) throw new Error(data.error?.message ?? 'Failed to fetch Threads profile')
      return NextResponse.json({ pages: [{ id: data.id, name: `@${data.username ?? data.id}` }] })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  return NextResponse.json({ pages: [] })
}

// POST: save selected page and swap to page access token
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { profileId, platform, pageId, pageName } = parsed.data

  // Verify profile belongs to the caller's org
  const { data: profileOwner } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()
  if (!profileOwner) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Get the user token
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('profile_id', profileId)
    .eq('platform', platform)
    .single()

  if (!tokenRow) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  const userToken = await decryptToken(tokenRow.access_token as string)

  let finalToken = userToken
  let finalUserId = pageId
  let finalUsername = pageName ?? pageId

  try {
    if (platform === 'facebook') {
      // Get the page-specific access token
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=access_token,name&access_token=${userToken}`
      )
      const data = await res.json() as { access_token?: string; name?: string }
      if (data.access_token) {
        // Exchange for long-lived page token
        const llRes = await fetch(
          `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${data.access_token}`
        )
        const llData = await llRes.json() as { access_token?: string }
        finalToken = llData.access_token ?? data.access_token
      }
      finalUsername = data.name ?? pageId
    } else if (platform === 'instagram') {
      // For Instagram, we use the user token but post via IG user ID
      // The pageId here IS the IG business account ID
      finalUserId = pageId
    }
    // Threads uses user token directly
  } catch {
    // Use user token as fallback
  }

  const encryptedFinal = await encryptToken(finalToken)

  await supabase.from('oauth_tokens').update({
    access_token: encryptedFinal,
    platform_user_id: finalUserId,
    platform_username: finalUsername,
    platform_page_id: pageId,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', profileId).eq('platform', platform)

  await supabase.from('oauth_audit_log').insert({
    profile_id: profileId,
    platform,
    action: 'connect',
    success: true,
    metadata: { page_id: pageId, page_name: finalUsername },
  })

  return NextResponse.json({ success: true })
}
