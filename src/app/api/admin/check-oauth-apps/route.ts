export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { PLATFORM_AUTOMATION, type PlatformKey } from '@/lib/oauth-registration/automation-support'
import { supabase } from '@/lib/supabase'
import { isSessionValid } from '@/lib/playwright-sessions'


const FANOUT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fanout.digital'

export async function POST(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.FANOUT_ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: credentials } = await supabase
    .from('oauth_app_credentials')
    .select('platform, status')

  const existingPlatforms = new Set((credentials ?? []).map((c) => c.platform))
  const pendingPlatforms: string[] = []
  const triggeredPlatforms: string[] = []
  const manualRequiredPlatforms: string[] = []

  for (const [platform, config] of Object.entries(PLATFORM_AUTOMATION) as [PlatformKey, typeof PLATFORM_AUTOMATION[PlatformKey]][]) {
    const existing = (credentials ?? []).find((c) => c.platform === platform)

    // Skip already active
    if (existing?.status === 'active') continue

    if (!existingPlatforms.has(platform) || existing?.status === 'pending') {
      if (config.canAutomate) {
        const sessionOk = isSessionValid(platform)
        if (sessionOk) {
          // Auto-trigger registration
          await fetch(`${FANOUT_BASE_URL}/api/admin/register-oauth-app`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-key': process.env.FANOUT_ADMIN_KEY!,
            },
            body: JSON.stringify({
              platform,
              appName: 'Fanout',
              callbackUrl: `${FANOUT_BASE_URL}/api/oauth/${platform}/callback`,
            }),
          })
          triggeredPlatforms.push(platform)
        } else {
          pendingPlatforms.push(platform)
        }
      } else {
        manualRequiredPlatforms.push(platform)
      }
    }
  }

  // Send notification email if anything needs attention
  const needsAttention = [...pendingPlatforms, ...manualRequiredPlatforms]
  if (needsAttention.length > 0) {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && resendKey !== 'placeholder') {
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: 'Fanout <noreply@fanout.digital>',
        to: 'brad@nustack.digital',
        subject: `Fanout: ${needsAttention.length} platform(s) need OAuth app setup`,
        html: `
          <h2>OAuth App Setup Required</h2>
          <p>The following platforms need OAuth apps registered:</p>
          ${pendingPlatforms.length > 0 ? `
            <h3>Session Bootstrap Needed (can be automated once session saved):</h3>
            <ul>${pendingPlatforms.map((p) => `<li>${p} — run <code>npx ts-node scripts/bootstrap-session.ts ${p}</code></li>`).join('')}</ul>
          ` : ''}
          ${manualRequiredPlatforms.length > 0 ? `
            <h3>Manual Setup Required (review process):</h3>
            <ul>${manualRequiredPlatforms.map((p) => `<li>${p}</li>`).join('')}</ul>
          ` : ''}
          <p><a href="${FANOUT_BASE_URL}/dashboard/admin/oauth-apps">Open Admin Dashboard →</a></p>
        `,
      }).catch(() => null)
    }
  }

  return NextResponse.json({
    triggered: triggeredPlatforms,
    pendingSession: pendingPlatforms,
    manualRequired: manualRequiredPlatforms,
  })
}
