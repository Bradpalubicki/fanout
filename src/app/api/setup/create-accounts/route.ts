import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

const schema = z.object({
  platforms: z.array(z.string()),
  businessInfo: z.object({
    name: z.string(),
    category: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    website: z.string().optional(),
  }),
  brandData: z.record(z.string(), z.unknown()).nullable(),
  platformBios: z.array(z.object({
    platform: z.string(),
    displayName: z.string(),
    bio: z.string(),
    hashtags: z.array(z.string()),
  })).optional(),
})

// Platforms we can attempt via Playwright on Runner
const PLAYWRIGHT_PLATFORMS = ['twitter', 'reddit', 'tiktok', 'youtube']

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { platforms, businessInfo, brandData, platformBios } = parsed.data
  const results: Record<string, { status: string; error?: string; username?: string }> = {}

  const RUNNER_URL = process.env.RUNNER_URL
  const RUNNER_SECRET = process.env.RUNNER_SECRET

  for (const platform of platforms) {
    if (!PLAYWRIGHT_PLATFORMS.includes(platform)) {
      results[platform] = { status: 'skipped', error: 'Manual OAuth required — connect via profile settings' }
      continue
    }

    if (!RUNNER_URL || !RUNNER_SECRET) {
      results[platform] = { status: 'skipped', error: 'Runner not configured' }
      continue
    }

    const profileData = platformBios?.find((b) => b.platform === platform)

    try {
      const runnerRes = await fetch(`${RUNNER_URL}/create-social-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-runner-secret': RUNNER_SECRET,
        },
        body: JSON.stringify({
          platform,
          businessInfo,
          brandData,
          profileData,
        }),
      })

      const data = await runnerRes.json() as {
        success: boolean
        username?: string
        error?: string
        partialProgress?: boolean
      }

      results[platform] = {
        status: data.success ? 'created' : data.partialProgress ? 'requires_verification' : 'failed',
        username: data.username,
        error: data.error,
      }
    } catch (err) {
      results[platform] = {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Runner unavailable',
      }
    }
  }

  return NextResponse.json({ results })
}
