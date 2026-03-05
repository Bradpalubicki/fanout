/**
 * Bootstrap a persistent browser session for a social media developer portal.
 *
 * Usage: npx ts-node scripts/bootstrap-session.ts <platform>
 *
 * This opens a visible browser window. You log in manually (including 2FA).
 * The session is saved so Playwright scripts can reuse it without re-logging in.
 *
 * Platforms: reddit | twitter | linkedin | youtube | pinterest | tiktok
 */

import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import readline from 'readline'

const VALID_PLATFORMS = ['reddit', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'facebook', 'instagram', 'threads']

const PORTAL_URLS: Record<string, string> = {
  reddit: 'https://www.reddit.com/login',
  twitter: 'https://twitter.com/login',
  linkedin: 'https://www.linkedin.com/login',
  youtube: 'https://accounts.google.com/signin',
  pinterest: 'https://www.pinterest.com/login/',
  tiktok: 'https://www.tiktok.com/login',
  facebook: 'https://www.facebook.com/login',
  instagram: 'https://www.instagram.com/accounts/login/',
  threads: 'https://www.threads.net/login',
}

const POST_LOGIN_PATTERNS: Record<string, RegExp> = {
  reddit: /reddit\.com\/(r\/|user\/|prefs|feed)/,
  twitter: /twitter\.com\/home|x\.com\/home/,
  linkedin: /linkedin\.com\/feed|linkedin\.com\/in\//,
  youtube: /myaccount\.google\.com|console\.cloud\.google\.com|youtube\.com\/[^/]+\/account/,
  pinterest: /pinterest\.com\/[^/]+\/?$/,
  tiktok: /tiktok\.com\/@/,
  facebook: /facebook\.com\/?$/,
  instagram: /instagram\.com\/?$/,
  threads: /threads\.net\/?$/,
}

const SESSIONS_BASE = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? 'C:/Users/bradp',
  '.fanout-sessions'
)

function waitForEnter(prompt: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, () => {
      rl.close()
      resolve()
    })
  })
}

async function bootstrap(platform: string) {
  if (!VALID_PLATFORMS.includes(platform)) {
    console.error(`Invalid platform: ${platform}`)
    console.error(`Valid platforms: ${VALID_PLATFORMS.join(', ')}`)
    process.exit(1)
  }

  const sessionDir = path.join(SESSIONS_BASE, platform)
  fs.mkdirSync(sessionDir, { recursive: true })

  console.log(`\n🚀 Bootstrapping session for: ${platform}`)
  console.log(`Session will be saved to: ${sessionDir}`)
  console.log('\nOpening browser... Complete the login + 2FA manually.\n')

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: false,
    args: ['--start-maximized'],
    viewport: null,
  })

  const page = await browser.newPage()
  await page.goto(PORTAL_URLS[platform], { waitUntil: 'networkidle' })

  console.log('Browser opened. Please:')
  console.log('  1. Log in with your developer account credentials')
  console.log('  2. Complete any 2FA prompts')
  console.log('  3. Wait until you see the main dashboard/feed')
  console.log('\nPress ENTER here once you are fully logged in...')

  await waitForEnter('')

  // Check if actually logged in by URL pattern
  const currentUrl = page.url()
  const pattern = POST_LOGIN_PATTERNS[platform]
  const isLoggedIn = pattern.test(currentUrl) || !currentUrl.includes('login')

  if (!isLoggedIn) {
    console.warn(`⚠️  Warning: URL doesn't look like a post-login page: ${currentUrl}`)
    console.warn('Session saved anyway — verify it works by running a registration test.')
  }

  // Save session validity marker (30 days)
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  fs.writeFileSync(path.join(sessionDir, 'session-valid'), validUntil.toISOString())
  fs.writeFileSync(path.join(sessionDir, 'platform.txt'), platform)
  fs.writeFileSync(path.join(sessionDir, 'bootstrapped-at.txt'), new Date().toISOString())

  await browser.close()

  console.log(`\n✅ Session saved for ${platform}!`)
  console.log(`   Valid until: ${validUntil.toLocaleDateString()}`)
  console.log(`\nNext steps:`)
  console.log(`  Auto-register the ${platform} app:`)
  console.log(`  curl -X POST https://fanout.digital/api/admin/register-oauth-app \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -H "x-admin-key: YOUR_ADMIN_KEY" \\`)
  console.log(`    -d '{"platform":"${platform}","appName":"Fanout","callbackUrl":"https://fanout.digital/api/oauth/${platform}/callback"}'`)
}

const platform = process.argv[2]
if (!platform) {
  console.error('Usage: npx ts-node scripts/bootstrap-session.ts <platform>')
  console.error(`Platforms: ${VALID_PLATFORMS.join(', ')}`)
  process.exit(1)
}

bootstrap(platform).catch((err) => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
