export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyApiKey } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const auth = await verifyApiKey(req.headers.get('authorization'))
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { platform } = await params

  const { error } = await supabase
    .from('oauth_tokens')
    .delete()
    .eq('profile_id', auth.profile.id)
    .eq('platform', platform)

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect platform' }, { status: 500 })
  }

  await supabase.from('oauth_audit_log').insert({
    profile_id: auth.profile.id,
    platform,
    action: 'revoke',
    success: true,
  })

  return NextResponse.json({ success: true, platform, disconnected: true })
}
