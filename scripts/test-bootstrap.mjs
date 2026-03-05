/**
 * TEST: Bootstrap a browser session using YOUR OWN account.
 * This is the test path — uses your personal Reddit/Twitter/etc account,
 * not dedicated developer accounts. Validates the full automation pipeline.
 *
 * Usage:
 *   node scripts/test-bootstrap.mjs reddit
 *   node scripts/test-bootstrap.mjs twitter
 *   node scripts/test-bootstrap.mjs linkedin
 *   node scripts/test-bootstrap.mjs youtube
 *
 * What happens:
 *   1. Opens a real visible browser window
 *   2. You log in manually (your own account — no dedicated dev email needed)
 *   3. Session is saved to ~/.fanout-sessions/<platform>/
 *   4. Next step: run test-register.mjs to auto-create the OAuth app
 */

import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import os from 'os'

const VALID_PLATFORMS = ['reddit', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok', 'facebook']

const PORTAL_URLS = {
  reddit:   'https://www.reddit.com/login',
  twitter:  'https://twitter.com/login',
  linkedin: 'https://www.linkedin.com/login',
  youtube:  'https://accounts.google.com/signin',
  pinterest:'https://www.pinterest.com/login/',
  tiktok:   'https://www.tiktok.com/login',
  facebook: 'https://www.facebook.com/login',
}

// After login, URL should match one of these patterns
const POST_LOGIN_PATTERNS = {
  reddit:   /reddit\.com\/(r\/|user\/|prefs|feed|\?)|reddit\.com\/$/,
  twitter:  /twitter\.com\/home|x\.com\/home/,
  linkedin: /linkedin\.com\/feed|linkedin\.com\/mynetwork/,
  youtube:  /myaccount\.google\.com|console\.cloud\.google\.com|youtube\.com/,
  pinterest:/pinterest\.com\/[^/]+\/?$/,
  tiktok:   /tiktok\.com\/@/,
  facebook: /facebook\.com\/?($|\?)/,
}

const SESSIONS_BASE = path.join(os.homedir(), '.fanout-sessions')

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, () => { rl.close(); resolve() })
  })
}

const platform = process.argv[2]

if (!platform || !VALID_PLATFORMS.includes(platform)) {
  console.error(`Usage: node scripts/test-bootstrap.mjs <platform>`)
  console.error(`Platforms: ${VALID_PLATFORMS.join(', ')}`)
  process.exit(1)
}

const sessionDir = path.join(SESSIONS_BASE, platform)
fs.mkdirSync(sessionDir, { recursive: true })

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Fanout Session Bootstrap — ${platform.toUpperCase()}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`\nUsing YOUR account (test mode) — not a dedicated developer account.`)
console.log(`Session dir: ${sessionDir}`)
console.log(`\nOpening browser...\n`)

const browser = await chromium.launchPersistentContext(sessionDir, {
  headless: false,
  args: ['--start-maximized'],
  viewport: null,
})

const page = await browser.newPage()
await page.goto(PORTAL_URLS[platform], { waitUntil: 'domcontentloaded', timeout: 30000 })

console.log(`Browser opened at: ${PORTAL_URLS[platform]}`)
console.log(`\nPlease:`)
console.log(`  1. Log in with your account`)
console.log(`  2. Complete any 2FA if prompted`)
console.log(`  3. Wait until you see your home feed / dashboard`)
console.log(`\nPress ENTER here once you are fully logged in...`)

await waitForEnter('')

const currentUrl = page.url()
const pattern = POST_LOGIN_PATTERNS[platform]
const looksLoggedIn = pattern.test(currentUrl) || !currentUrl.includes('login')

if (!looksLoggedIn) {
  console.warn(`\n⚠️  Warning: Current URL doesn't look like a post-login page:`)
  console.warn(`   ${currentUrl}`)
  console.warn(`   Saving session anyway. Verify in the next step.\n`)
} else {
  console.log(`\n✓ Login detected at: ${currentUrl}`)
}

// Save session markers
const validUntil = new Date()
validUntil.setDate(validUntil.getDate() + 30)
fs.writeFileSync(path.join(sessionDir, 'session-valid'), validUntil.toISOString())
fs.writeFileSync(path.join(sessionDir, 'platform.txt'), platform)
fs.writeFileSync(path.join(sessionDir, 'bootstrapped-at.txt'), new Date().toISOString())
fs.writeFileSync(path.join(sessionDir, 'account-type.txt'), 'personal-test')

await browser.close()

console.log(`\n✅ Session saved for ${platform}!`)
console.log(`   Valid until: ${validUntil.toLocaleDateString()}`)
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Next step: register the OAuth app`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`\n  node scripts/test-register.mjs ${platform}`)
console.log(``)
