import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const QuerySchema = z.object({ profileId: z.string().min(1) })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { platform } = await params
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ profileId: url.searchParams.get('profileId') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 })
  }

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: token } = await supabase
    .from('oauth_tokens')
    .select('platform, platform_username')
    .eq('profile_id', profile.id)
    .eq('platform', platform)
    .maybeSingle()

  return NextResponse.json({
    connected: !!token,
    platform,
    username: token?.platform_username ?? null,
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { platform } = await params
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ profileId: url.searchParams.get('profileId') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 })
  }

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.profileId)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('oauth_tokens')
    .delete()
    .eq('profile_id', profile.id)
    .eq('platform', platform)

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true, platform, disconnected: true })
}
