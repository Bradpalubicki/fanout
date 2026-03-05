import { chromium } from '@playwright/test'
import { getSessionDir, isSessionValid } from '@/lib/playwright-sessions'
import { generateTotpCode } from '@/lib/oauth-registration/totp'

export interface TwitterAppResult {
  clientId: string
  clientSecret: string
  appName: string
  appId: string
}

export interface TwitterRegistrationOptions {
  appName: string
  callbackUrl: string
  websiteUrl?: string
  totpSecret?: string
}

export async function registerTwitterApp(
  options: TwitterRegistrationOptions
): Promise<TwitterAppResult> {
  const sessionDir = getSessionDir('twitter')

  if (!isSessionValid('twitter')) {
    throw new Error('Twitter session not valid. Run bootstrap-session.ts twitter first.')
  }

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: true,
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()

  try {
    await page.goto('https://developer.twitter.com/en/portal/apps/new', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // Handle 2FA if prompted
    const twoFAField = page.locator('input[name="otp"], input[placeholder*="verification"], input[placeholder*="code"]')
    if (await twoFAField.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (!options.totpSecret) {
        throw new Error('Twitter requires 2FA but no TOTP secret provided.')
      }
      const code = await generateTotpCode(options.totpSecret)
      await twoFAField.fill(code)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2000)
    }

    // Fill app name
    const nameInput = page.locator('input[placeholder*="App name"], input[name*="name"]').first()
    await nameInput.waitFor({ timeout: 10000 })
    await nameInput.fill(options.appName)

    // Submit app name
    await page.click('button:has-text("Next"), button[type="submit"]')
    await page.waitForTimeout(2000)

    // Save keys screen — capture them
    const clientIdEl = page.locator('[data-testid="client-id"], code').first()
    await clientIdEl.waitFor({ timeout: 10000 })

    const clientId = await clientIdEl.textContent() ?? ''
    const clientSecret = await page.locator('[data-testid="client-secret"], code').nth(1).textContent() ?? ''
    const appId = await page.locator('[data-testid="app-id"], code').nth(2).textContent().catch(() => '') ?? ''

    // Click through to app settings to set callback URL
    await page.click('button:has-text("Done"), button:has-text("Continue")')
    await page.waitForNavigation({ timeout: 10000 }).catch(() => null)

    // Navigate to auth settings
    const settingsUrl = page.url()
    if (settingsUrl.includes('/portal/apps/')) {
      const appIdFromUrl = settingsUrl.match(/\/apps\/(\d+)/)?.[1]
      if (appIdFromUrl) {
        await page.goto(
          `https://developer.twitter.com/en/portal/apps/${appIdFromUrl}/settings`,
          { waitUntil: 'networkidle' }
        )

        // Edit auth settings
        await page.click('button:has-text("Edit"), a:has-text("Edit")')
        await page.waitForTimeout(1000)

        // Set OAuth 2.0 callback
        const callbackInput = page.locator('input[placeholder*="callback"], input[placeholder*="redirect"]').first()
        if (await callbackInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await callbackInput.fill(options.callbackUrl)
          await page.fill('input[placeholder*="website"]', options.websiteUrl ?? 'https://fanout.digital')
          await page.click('button:has-text("Save")')
          await page.waitForTimeout(2000)
        }
      }
    }

    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      appName: options.appName,
      appId: appId.trim(),
    }
  } finally {
    await browser.close()
  }
}
