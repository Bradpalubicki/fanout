/**
 * TEST: Auto-register an OAuth app using the saved browser session.
 * Uses YOUR account's developer portal — no dedicated email needed for testing.
 *
 * Usage:
 *   node scripts/test-register.mjs reddit
 *   node scripts/test-register.mjs twitter
 *   node scripts/test-register.mjs linkedin
 *   node scripts/test-register.mjs youtube
 *
 * Prerequisites:
 *   1. Run test-bootstrap.mjs first to save the session
 *   2. FANOUT_ADMIN_KEY set in .env.local
 *
 * What happens:
 *   1. Playwright opens browser using saved session (headless)
 *   2. Navigates to platform dev portal
 *   3. Creates the OAuth app with Fanout callback URL
 *   4. Extracts client ID + secret
 *   5. Saves to Supabase via /api/admin/register-oauth-app
 *   6. Prints env var commands to copy into Vercel
 */

import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createServer } from 'http'

const SESSIONS_BASE = path.join(os.homedir(), '.fanout-sessions')

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
const env = {}
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = val
    }
  }
}

const BASE_URL = env.NEXTAUTH_URL || 'https://fanout.digital'
const ADMIN_KEY = env.FANOUT_ADMIN_KEY || env.NEXT_PUBLIC_FANOUT_ADMIN_KEY
const CALLBACK_BASE = 'https://fanout.digital'

const platform = process.argv[2]
if (!platform) {
  console.error('Usage: node scripts/test-register.mjs <platform>')
  process.exit(1)
}

const sessionDir = path.join(SESSIONS_BASE, platform)
const sessionValidPath = path.join(sessionDir, 'session-valid')

if (!fs.existsSync(sessionValidPath)) {
  console.error(`\n❌ No session found for ${platform}.`)
  console.error(`   Run first: node scripts/test-bootstrap.mjs ${platform}\n`)
  process.exit(1)
}

const validUntil = new Date(fs.readFileSync(sessionValidPath, 'utf-8').trim())
if (validUntil < new Date()) {
  console.error(`\n❌ Session expired for ${platform} (expired ${validUntil.toLocaleDateString()}).`)
  console.error(`   Re-run: node scripts/test-bootstrap.mjs ${platform}\n`)
  process.exit(1)
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Fanout OAuth App Registration — ${platform.toUpperCase()}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Session valid until: ${validUntil.toLocaleDateString()}`)
console.log(`  Callback URL: ${CALLBACK_BASE}/api/oauth/${platform}/callback`)
console.log(`  Running headless Playwright...\n`)

async function registerReddit() {
  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: false, // keep visible for testing so you can see what's happening
    args: ['--start-maximized'],
    viewport: null,
  })
  const page = await browser.newPage()

  try {
    await page.goto('https://www.reddit.com/prefs/apps', { waitUntil: 'networkidle', timeout: 30000 })

    // Check login
    const url = page.url()
    if (url.includes('login')) {
      throw new Error('Session expired — not logged in. Re-run bootstrap.')
    }
    console.log('  ✓ Logged into Reddit')

    // Check if app already exists
    const existingApps = await page.locator('.developed-app .app-name, .app-list-item .title').allTextContents().catch(() => [])
    const appName = 'Fanout'
    const alreadyExists = existingApps.some(n => n.trim().toLowerCase() === appName.toLowerCase())

    if (alreadyExists) {
      console.log('  ✓ App "Fanout" already exists — extracting credentials...')
      const appRow = page.locator('.developed-app').filter({ hasText: appName }).first()
      const clientId = (await appRow.locator('.app-clientID span, td:first-child').first().textContent() ?? '').trim()
      const clientSecret = (await appRow.locator('.secret span').first().textContent() ?? '').trim()

      if (!clientId) {
        console.log('\n  App exists but could not auto-extract credentials.')
        console.log('  Please manually copy the Client ID and Secret from:')
        console.log('  https://www.reddit.com/prefs/apps')
        console.log('\n  Then run: node scripts/test-enter-manual.mjs reddit <clientId> <clientSecret>')
        await page.waitForTimeout(30000) // keep browser open
        return null
      }

      await browser.close()
      return { clientId, clientSecret, appName }
    }

    // Create new app
    console.log('  Creating new Reddit app...')
    const createBtn = page.locator('button:has-text("create another app"), button:has-text("create app"), input[value="create app"]')
    await createBtn.first().click({ timeout: 10000 })
    await page.waitForTimeout(1000)

    await page.fill('input[name="name"]', appName)
    await page.check('input[value="web"]').catch(() => page.check('input[name="type"][value="web"]'))
    await page.fill('input[name="redirect_uri"]', `${CALLBACK_BASE}/api/oauth/reddit/callback`)

    await page.click('button[type="submit"]:has-text("create app")')
    await page.waitForTimeout(2000)

    // Extract from new app
    const newApp = page.locator('.developed-app').filter({ hasText: appName }).first()
    await newApp.waitFor({ timeout: 8000 })

    // Reddit shows client ID as small text under the app name in the left column
    // The structure is: .app-clientID contains the ID, .secret contains the secret
    let clientId = ''
    let clientSecret = ''

    // Try multiple selector patterns Reddit has used
    const idSelectors = ['.app-clientID', 'td:has-text("personal use script") + td', 'code', '.app-list-item .edit-app']
    for (const sel of idSelectors) {
      const text = await newApp.locator(sel).first().textContent().catch(() => '')
      if (text && text.trim().length > 5 && !text.includes(' ')) {
        clientId = text.trim()
        break
      }
    }

    clientSecret = (await newApp.locator('.secret span, [id*="secret"]').first().textContent() ?? '').trim()

    if (!clientId || !clientSecret) {
      console.log('\n  ⚠️  Could not auto-extract credentials from new app.')
      console.log('  Browser is staying open — please copy the Client ID and Secret manually.')
      console.log('  Client ID: shown under the app name (looks like: AbCdEfGhIjKlMn)')
      console.log('  Secret: shown as "secret" field')
      console.log('\n  After copying, press Ctrl+C here then run:')
      console.log(`  node scripts/test-enter-manual.mjs reddit <clientId> <clientSecret>`)
      await page.waitForTimeout(60000)
      return null
    }

    await browser.close()
    return { clientId, clientSecret, appName }
  } catch (err) {
    console.error('  Error:', err.message)
    await browser.close().catch(() => {})
    return null
  }
}

async function saveCredentials(result) {
  if (!result?.clientId || !result?.clientSecret) return

  console.log(`\n  ✅ Got credentials for ${platform}:`)
  console.log(`     Client ID:     ${result.clientId}`)
  console.log(`     Client Secret: ${result.clientSecret.slice(0, 6)}${'*'.repeat(result.clientSecret.length - 6)}`)

  // Save to local file for reference
  const outPath = path.join(sessionDir, 'credentials.json')
  fs.writeFileSync(outPath, JSON.stringify({ ...result, platform, savedAt: new Date().toISOString() }, null, 2))
  console.log(`\n  Saved to: ${outPath}`)

  // Try to push to Fanout API
  if (ADMIN_KEY) {
    console.log(`\n  Saving to Fanout DB via API...`)
    try {
      const apiBase = BASE_URL.startsWith('http') ? BASE_URL : `https://${BASE_URL}`
      const res = await fetch(`${apiBase}/api/admin/register-oauth-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY,
        },
        body: JSON.stringify({
          platform,
          appName: result.appName,
          callbackUrl: `${CALLBACK_BASE}/api/oauth/${platform}/callback`,
          clientId: result.clientId,
          clientSecret: result.clientSecret,
        }),
      })
      if (res.ok) {
        console.log(`  ✅ Saved to Fanout DB`)
      } else {
        const body = await res.text()
        console.log(`  ⚠️  API returned ${res.status}: ${body}`)
      }
    } catch (err) {
      console.log(`  ⚠️  Could not reach API: ${err.message}`)
      console.log(`      (Run the app locally or deploy first, then re-run this script)`)
    }
  } else {
    console.log(`\n  ⚠️  FANOUT_ADMIN_KEY not found in .env.local — skipping API save.`)
  }

  // Print env var commands
  const envVarMap = {
    reddit:   { id: 'REDDIT_CLIENT_ID', secret: 'REDDIT_CLIENT_SECRET', callback: 'REDDIT_CALLBACK_URL' },
    twitter:  { id: 'TWITTER_CLIENT_ID', secret: 'TWITTER_CLIENT_SECRET', callback: 'TWITTER_CALLBACK_URL' },
    linkedin: { id: 'LINKEDIN_CLIENT_ID', secret: 'LINKEDIN_CLIENT_SECRET', callback: 'LINKEDIN_CALLBACK_URL' },
    youtube:  { id: 'YOUTUBE_CLIENT_ID', secret: 'YOUTUBE_CLIENT_SECRET', callback: 'YOUTUBE_CALLBACK_URL' },
  }

  const vars = envVarMap[platform]
  if (vars) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  Add these to Vercel environment variables:`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  ${vars.id}=${result.clientId}`)
    console.log(`  ${vars.secret}=${result.clientSecret}`)
    console.log(`  ${vars.callback}=${CALLBACK_BASE}/api/oauth/${platform}/callback`)
    console.log(`\n  Vercel CLI:`)
    console.log(`  vercel env add ${vars.id}`)
    console.log(`  vercel env add ${vars.secret}`)
    console.log(`  vercel env add ${vars.callback}`)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  Next step: connect your account in Fanout`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`  1. vercel env add ... (commands above)`)
    console.log(`  2. vercel --prod (redeploy)`)
    console.log(`  3. Open fanout.digital/dashboard/profiles`)
    console.log(`  4. Create a profile → Connect ${platform}`)
    console.log(`  5. Authorize with YOUR account`)
    console.log(`  6. Post a test post\n`)
  }
}

// Run the right platform
let result = null
if (platform === 'reddit') {
  result = await registerReddit()
} else {
  console.log(`\n  Automation for ${platform} requires a browser session.`)
  console.log(`  Opening the developer portal... log in and create the app manually.`)
  console.log(`  Then run: node scripts/test-enter-manual.mjs ${platform} <clientId> <clientSecret>\n`)

  const PORTAL_URLS = {
    twitter:  'https://developer.twitter.com/en/portal/apps/new',
    linkedin: 'https://www.linkedin.com/developers/apps/new',
    youtube:  'https://console.cloud.google.com/apis/credentials',
  }

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: false, args: ['--start-maximized'], viewport: null,
  })
  const page = await browser.newPage()
  await page.goto(PORTAL_URLS[platform] || `https://${platform}.com`, { waitUntil: 'domcontentloaded' })
  console.log(`  Browser opened. Create the app manually, then Ctrl+C here.`)
  console.log(`  Callback URL to enter: ${CALLBACK_BASE}/api/oauth/${platform}/callback`)
  await page.waitForTimeout(300000) // 5 minutes
  await browser.close()
}

await saveCredentials(result)
