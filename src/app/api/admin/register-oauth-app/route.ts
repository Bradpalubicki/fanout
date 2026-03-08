import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { PLATFORM_AUTOMATION, type PlatformKey } from '@/lib/oauth-registration/automation-support'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RegisterSchema = z.object({
  platform: z.enum([
    'twitter', 'linkedin', 'reddit', 'youtube',
    'pinterest', 'tiktok', 'facebook', 'instagram', 'threads',
  ]),
  appName: z.string().min(1).max(100),
  callbackUrl: z.string().url(),
  // For manual credential entry (fallback)
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
})

async function isNuStackAdmin(req: NextRequest): Promise<boolean> {
  if (req.headers.get('x-admin-key') === process.env.FANOUT_ADMIN_KEY) return true
  const { userId } = await auth()
  if (!userId) return false
  const clerk = await clerkClient()
  const user = await clerk.users.getUser(userId)
  return user.primaryEmailAddress?.emailAddress?.endsWith('@nustack.digital') ?? false
}

export async function POST(req: NextRequest) {
  if (!(await isNuStackAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { platform, appName, callbackUrl, clientId, clientSecret } = parsed.data
  const config = PLATFORM_AUTOMATION[platform as PlatformKey]

  // Manual credential entry path (always available as fallback)
  if (clientId && clientSecret) {
    const { error } = await supabase.from('oauth_app_credentials').upsert({
      platform,
      client_id: clientId,
      client_secret: clientSecret,
      app_name: appName,
      status: 'active',
      registered_at: new Date().toISOString(),
      notes: 'Manually entered credentials',
    }, { onConflict: 'platform' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, platform, method: 'manual' })
  }

  // Automated path
  if (!config.canAutomate) {
    return NextResponse.json({
      error: `${platform} requires manual setup. ${config.notes}`,
      manualUrl: config.devPortalUrl,
    }, { status: 422 })
  }

  // Get dev account credentials for this platform
  const { data: devAccount } = await supabase
    .from('developer_accounts')
    .select('*')
    .eq('platform', platform)
    .single()

  if (!devAccount) {
    return NextResponse.json({
      error: `No developer account configured for ${platform}. Add one in the admin dashboard.`,
    }, { status: 422 })
  }

  // Mark as in-progress
  await supabase.from('oauth_app_credentials').upsert({
    platform,
    app_name: appName,
    status: 'pending',
    notes: 'Automation in progress...',
  }, { onConflict: 'platform' })

  try {
    let result: { clientId: string; clientSecret: string } | null = null

    if (platform === 'reddit') {
      const { registerRedditApp } = await import('@/lib/oauth-registration/reddit')
      const r = await registerRedditApp({
        appName,
        callbackUrl,
        totpSecret: devAccount.totp_secret,
      })
      result = r
    } else if (platform === 'twitter') {
      const { registerTwitterApp } = await import('@/lib/oauth-registration/twitter')
      const r = await registerTwitterApp({
        appName,
        callbackUrl,
        totpSecret: devAccount.totp_secret,
      })
      result = r
    } else if (platform === 'linkedin') {
      const { registerLinkedInApp } = await import('@/lib/oauth-registration/linkedin')
      const r = await registerLinkedInApp({
        appName,
        callbackUrl,
        totpSecret: devAccount.totp_secret,
      })
      result = r
    } else if (platform === 'youtube') {
      const { registerYouTubeApp } = await import('@/lib/oauth-registration/youtube')
      const r = await registerYouTubeApp({
        projectName: appName,
        callbackUrl,
        totpSecret: devAccount.totp_secret,
      })
      result = r
    }

    if (!result) {
      throw new Error(`No registration handler for platform: ${platform}`)
    }

    await supabase.from('oauth_app_credentials').upsert({
      platform,
      client_id: result.clientId,
      client_secret: result.clientSecret,
      app_name: appName,
      status: 'active',
      registered_at: new Date().toISOString(),
      notes: 'Auto-registered via Playwright',
    }, { onConflict: 'platform' })

    return NextResponse.json({
      ok: true,
      platform,
      clientId: result.clientId,
      method: 'automated',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await supabase.from('oauth_app_credentials').upsert({
      platform,
      status: 'error',
      notes: `Automation failed: ${message}`,
    }, { onConflict: 'platform' })

    return NextResponse.json({ error: message, platform }, { status: 500 })
  }
}
