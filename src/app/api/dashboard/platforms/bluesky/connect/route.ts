export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const schema = z.object({
  profileId: z.string(),
  identifier: z.string().min(3),
  password: z.string().min(4),
})

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { profileId, identifier, password } = parsed.data

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('org_id', orgId)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Verify credentials work by creating a session
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  if (!sessionRes.ok) {
    return NextResponse.json({ error: 'Invalid Bluesky credentials — check your handle and app password' }, { status: 400 })
  }
  const sessionData = await sessionRes.json() as { did?: string; handle?: string }

  // Upsert oauth_token — store JSON creds as access_token
  const { error } = await supabase
    .from('oauth_tokens')
    .upsert(
      {
        profile_id: profileId,
        platform: 'bluesky',
        access_token: JSON.stringify({ identifier, password }),
        platform_page_id: sessionData.did ?? null,
        platform_username: sessionData.handle ?? identifier,
        expires_at: null, // app passwords don't expire
        refresh_token: null,
      },
      { onConflict: 'profile_id,platform' }
    )

  if (error) return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 })
  return NextResponse.json({ success: true })
}
