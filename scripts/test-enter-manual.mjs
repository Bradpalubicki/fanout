/**
 * Manually enter OAuth credentials for a platform that couldn't be auto-extracted.
 *
 * Usage:
 *   node scripts/test-enter-manual.mjs reddit <clientId> <clientSecret>
 *   node scripts/test-enter-manual.mjs twitter <clientId> <clientSecret>
 *   node scripts/test-enter-manual.mjs linkedin <clientId> <clientSecret>
 *   node scripts/test-enter-manual.mjs youtube <clientId> <clientSecret>
 *
 * This saves the credentials to:
 *   - ~/.fanout-sessions/<platform>/credentials.json (local reference)
 *   - Fanout DB via /api/admin/register-oauth-app
 *   - Prints Vercel CLI commands
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

const SESSIONS_BASE = path.join(os.homedir(), '.fanout-sessions')
const CALLBACK_BASE = 'https://fanout.digital'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
const env = {}
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const [platform, clientId, clientSecret] = process.argv.slice(2)

if (!platform || !clientId || !clientSecret) {
  console.error('Usage: node scripts/test-enter-manual.mjs <platform> <clientId> <clientSecret>')
  process.exit(1)
}

const ENV_VARS = {
  reddit:   { id: 'REDDIT_CLIENT_ID', secret: 'REDDIT_CLIENT_SECRET', callback: 'REDDIT_CALLBACK_URL' },
  twitter:  { id: 'TWITTER_CLIENT_ID', secret: 'TWITTER_CLIENT_SECRET', callback: 'TWITTER_CALLBACK_URL' },
  linkedin: { id: 'LINKEDIN_CLIENT_ID', secret: 'LINKEDIN_CLIENT_SECRET', callback: 'LINKEDIN_CALLBACK_URL' },
  youtube:  { id: 'YOUTUBE_CLIENT_ID', secret: 'YOUTUBE_CLIENT_SECRET', callback: 'YOUTUBE_CALLBACK_URL' },
  facebook: { id: 'FACEBOOK_APP_ID', secret: 'FACEBOOK_APP_SECRET', callback: 'FACEBOOK_CALLBACK_URL' },
  instagram:{ id: 'INSTAGRAM_APP_ID', secret: 'INSTAGRAM_APP_SECRET', callback: 'FACEBOOK_CALLBACK_URL' },
  tiktok:   { id: 'TIKTOK_CLIENT_KEY', secret: 'TIKTOK_CLIENT_SECRET', callback: 'TIKTOK_CALLBACK_URL' },
  pinterest:{ id: 'PINTEREST_APP_ID', secret: 'PINTEREST_APP_SECRET', callback: 'PINTEREST_CALLBACK_URL' },
  threads:  { id: 'THREADS_APP_ID', secret: 'THREADS_APP_SECRET', callback: 'FACEBOOK_CALLBACK_URL' },
}

const sessionDir = path.join(SESSIONS_BASE, platform)
fs.mkdirSync(sessionDir, { recursive: true })

const result = { platform, clientId, clientSecret, appName: 'Fanout', savedAt: new Date().toISOString() }
fs.writeFileSync(path.join(sessionDir, 'credentials.json'), JSON.stringify(result, null, 2))

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Credentials saved — ${platform.toUpperCase()}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

// Push to API
const ADMIN_KEY = env.FANOUT_ADMIN_KEY || env.NEXT_PUBLIC_FANOUT_ADMIN_KEY
if (ADMIN_KEY) {
  try {
    const res = await fetch(`${CALLBACK_BASE}/api/admin/register-oauth-app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({
        platform, appName: 'Fanout',
        callbackUrl: `${CALLBACK_BASE}/api/oauth/${platform}/callback`,
        clientId, clientSecret,
      }),
    })
    console.log(res.ok ? `\n  ✅ Saved to Fanout DB` : `\n  ⚠️  API: ${res.status} ${await res.text()}`)
  } catch (e) {
    console.log(`\n  ⚠️  Could not reach API: ${e.message}`)
  }
}

const vars = ENV_VARS[platform]
if (vars) {
  console.log(`\n  Vercel env vars to add:`)
  console.log(`  ──────────────────────`)
  console.log(`  ${vars.id}=${clientId}`)
  console.log(`  ${vars.secret}=${clientSecret}`)
  console.log(`  ${vars.callback}=${CALLBACK_BASE}/api/oauth/${platform}/callback`)
  console.log(`\n  Vercel CLI (run in project dir):`)
  console.log(`  vercel env add ${vars.id} production`)
  console.log(`  vercel env add ${vars.secret} production`)
  console.log(`  vercel env add ${vars.callback} production`)
  console.log(`  vercel --prod`)
}

console.log(`\n  Next: fanout.digital/dashboard/profiles → Connect ${platform}\n`)
