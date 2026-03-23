export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateTotpCode } from '@/lib/oauth-registration/totp'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/admin/2fa-codes?platform=twitter&channel=sms
// Polled by Playwright scripts to get the latest valid code
export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.FANOUT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform')
  const channel = searchParams.get('channel') ?? 'sms'

  if (!platform) {
    return NextResponse.json({ error: 'platform required' }, { status: 400 })
  }

  // For TOTP: generate code from stored secret
  if (channel === 'totp') {
    const { data: devAccount } = await supabase
      .from('developer_accounts')
      .select('totp_secret')
      .eq('platform', platform)
      .single()

    if (!devAccount?.totp_secret) {
      return NextResponse.json({ error: 'No TOTP secret configured for this platform' }, { status: 404 })
    }

    const code = await generateTotpCode(devAccount.totp_secret)
    return NextResponse.json({ code, channel: 'totp', platform })
  }

  // For SMS/email: fetch latest unused code from DB
  const { data: codeRow } = await supabase
    .from('two_factor_codes')
    .select('*')
    .eq('platform', platform)
    .eq('channel', channel)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('received_at', { ascending: false })
    .limit(1)
    .single()

  if (!codeRow) {
    return NextResponse.json({ error: 'No valid code found. Waiting for SMS/email.' }, { status: 404 })
  }

  // Mark as used
  await supabase
    .from('two_factor_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', codeRow.id)

  return NextResponse.json({
    code: codeRow.code,
    channel: codeRow.channel,
    platform: codeRow.platform,
    receivedAt: codeRow.received_at,
  })
}
