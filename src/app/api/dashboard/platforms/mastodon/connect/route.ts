export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const schema = z.object({
  profileId: z.string(),
  instanceUrl: z.string().url(),
  accessToken: z.string().min(4),
})

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { profileId, instanceUrl, accessToken } = parsed.data

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Verify credentials by fetching the authenticated account
  const verifyRes = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!verifyRes.ok) {
    return NextResponse.json(
      { error: 'Invalid Mastodon credentials — check your instance URL and access token' },
      { status: 400 }
    )
  }
  const accountData = await verifyRes.json() as { id?: string; username?: string; acct?: string }

  // Upsert oauth_token — store instanceUrl as platform_page_id (matches mastodon distributor)
  const { error } = await supabase
    .from('oauth_tokens')
    .upsert(
      {
        profile_id: profileId,
        platform: 'mastodon',
        access_token: accessToken,
        platform_page_id: instanceUrl, // mastodon distributor reads this as instance_url
        platform_username: accountData.acct ?? accountData.username ?? null,
        expires_at: null,
        refresh_token: null,
      },
      { onConflict: 'profile_id,platform' }
    )

  if (error) return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 })
  return NextResponse.json({ success: true })
}
