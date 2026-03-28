export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabase } from '@/lib/supabase'
import { encryptToken } from '@/lib/crypto'
import { PRODUCTS, PRODUCT_CONFIGS } from '@/lib/product-platforms'

// ---------------------------------------------------------------------------
// Auto-connect Bluesky and Mastodon for all NuStack products
//
// Bluesky: reads BLUESKY_{PRODUCT}_IDENTIFIER + BLUESKY_{PRODUCT}_APP_PASSWORD
// Mastodon: reads MASTODON_{PRODUCT}_ACCESS_TOKEN + MASTODON_{PRODUCT}_INSTANCE_URL
//
// Env var naming convention (product slug uppercased, hyphens → underscores):
//   certusaudit  → CERTUSAUDIT
//   pocketpals   → POCKETPALS
//   sitegrade    → SITEGRADE
//   wellness-engine → WELLNESS_ENGINE
// ---------------------------------------------------------------------------

function productEnvKey(product: string): string {
  return product.toUpperCase().replace(/-/g, '_')
}

interface ConnectResult {
  product: string
  platform: string
  status: 'connected' | 'skipped' | 'error' | 'no_creds'
  handle?: string
  message: string
}

async function autoConnectBluesky(product: string): Promise<ConnectResult> {
  const envKey = productEnvKey(product)
  const identifier = process.env[`BLUESKY_${envKey}_IDENTIFIER`]
  const appPassword = process.env[`BLUESKY_${envKey}_APP_PASSWORD`]

  if (!identifier || !appPassword) {
    return {
      product,
      platform: 'bluesky',
      status: 'no_creds',
      message: `Missing env: BLUESKY_${envKey}_IDENTIFIER / BLUESKY_${envKey}_APP_PASSWORD`,
    }
  }

  // Verify credentials work by creating a session
  let did = ''
  try {
    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
    })
    const data = await res.json() as { did?: string; error?: string; message?: string }
    if (!res.ok || !data.did) {
      return {
        product,
        platform: 'bluesky',
        status: 'error',
        message: `Bluesky login failed: ${data.error ?? data.message ?? 'unknown'}`,
      }
    }
    did = data.did
  } catch (e) {
    return {
      product,
      platform: 'bluesky',
      status: 'error',
      message: `Bluesky network error: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  // Store credentials encrypted in product_platform_accounts
  // access_token = JSON { identifier, password } — same format BlueskyDistributor expects
  const tokenPayload = JSON.stringify({ identifier, password: appPassword })
  let encryptedToken: string
  try {
    encryptedToken = await encryptToken(tokenPayload)
  } catch (e) {
    return {
      product,
      platform: 'bluesky',
      status: 'error',
      message: `Encryption failed: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('product_platform_accounts')
    .upsert(
      {
        product,
        platform: 'bluesky',
        account_handle: `@${identifier.replace(/^@/, '')}`,
        access_token: encryptedToken,
        platform_user_id: did,
        status: 'active',
        extra_config: { identifier },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product,platform' }
    )

  if (error) {
    return {
      product,
      platform: 'bluesky',
      status: 'error',
      message: `DB upsert failed: ${error.message}`,
    }
  }

  return {
    product,
    platform: 'bluesky',
    status: 'connected',
    handle: `@${identifier.replace(/^@/, '')}`,
    message: `Connected as @${identifier.replace(/^@/, '')} (DID: ${did.slice(0, 20)}…)`,
  }
}

async function autoConnectMastodon(product: string): Promise<ConnectResult> {
  const envKey = productEnvKey(product)
  const accessToken = process.env[`MASTODON_${envKey}_ACCESS_TOKEN`]
  const instanceUrl = process.env[`MASTODON_${envKey}_INSTANCE_URL`] ?? 'https://mastodon.social'

  if (!accessToken) {
    return {
      product,
      platform: 'mastodon',
      status: 'no_creds',
      message: `Missing env: MASTODON_${envKey}_ACCESS_TOKEN`,
    }
  }

  // Verify token
  let username = ''
  try {
    const res = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json() as { username?: string; error?: string }
    if (!res.ok || !data.username) {
      return {
        product,
        platform: 'mastodon',
        status: 'error',
        message: `Mastodon auth failed: ${data.error ?? 'invalid token'}`,
      }
    }
    username = data.username
  } catch (e) {
    return {
      product,
      platform: 'mastodon',
      status: 'error',
      message: `Mastodon network error: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  let encryptedToken: string
  try {
    encryptedToken = await encryptToken(accessToken)
  } catch (e) {
    return {
      product,
      platform: 'mastodon',
      status: 'error',
      message: `Encryption failed: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('product_platform_accounts')
    .upsert(
      {
        product,
        platform: 'mastodon',
        account_handle: `@${username}@${new URL(instanceUrl).hostname}`,
        access_token: encryptedToken,
        status: 'active',
        extra_config: { instance_url: instanceUrl },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product,platform' }
    )

  if (error) {
    return {
      product,
      platform: 'mastodon',
      status: 'error',
      message: `DB upsert failed: ${error.message}`,
    }
  }

  return {
    product,
    platform: 'mastodon',
    status: 'connected',
    handle: `@${username}@${new URL(instanceUrl).hostname}`,
    message: `Connected as @${username} on ${instanceUrl}`,
  }
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: ConnectResult[] = []

  for (const product of PRODUCTS) {
    const cfg = PRODUCT_CONFIGS[product]

    // Only attempt Bluesky/Mastodon for products that have them in their platform list
    // (all products can use both — these are open platforms)
    if (cfg.platforms.includes('bluesky') || true) {
      results.push(await autoConnectBluesky(product))
    }
    if (cfg.platforms.includes('mastodon') || true) {
      results.push(await autoConnectMastodon(product))
    }
  }

  const connected = results.filter((r) => r.status === 'connected')
  const errors = results.filter((r) => r.status === 'error')
  const noCreds = results.filter((r) => r.status === 'no_creds')

  return NextResponse.json({
    results,
    summary: {
      connected: connected.length,
      errors: errors.length,
      no_creds: noCreds.length,
      total: results.length,
    },
  })
}

// GET — check current auto-connect status without connecting
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const envKey_map = Object.fromEntries(
    PRODUCTS.map((p) => [p, productEnvKey(p)])
  )

  const status = PRODUCTS.flatMap((product) => {
    const envKey = envKey_map[product]
    return [
      {
        product,
        platform: 'bluesky',
        has_creds:
          !!process.env[`BLUESKY_${envKey}_IDENTIFIER`] &&
          !!process.env[`BLUESKY_${envKey}_APP_PASSWORD`],
        env_vars: [`BLUESKY_${envKey}_IDENTIFIER`, `BLUESKY_${envKey}_APP_PASSWORD`],
      },
      {
        product,
        platform: 'mastodon',
        has_creds: !!process.env[`MASTODON_${envKey}_ACCESS_TOKEN`],
        env_vars: [
          `MASTODON_${envKey}_ACCESS_TOKEN`,
          `MASTODON_${envKey}_INSTANCE_URL (optional, defaults to mastodon.social)`,
        ],
      },
    ]
  })

  return NextResponse.json({ status })
}
