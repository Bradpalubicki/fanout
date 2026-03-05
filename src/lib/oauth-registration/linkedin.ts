import { chromium } from '@playwright/test'
import { getSessionDir, isSessionValid } from '@/lib/playwright-sessions'
import { generateTotpCode } from '@/lib/oauth-registration/totp'

export interface LinkedInAppResult {
  clientId: string
  clientSecret: string
  appName: string
}

export interface LinkedInRegistrationOptions {
  appName: string
  callbackUrl: string
  companyName?: string
  privacyPolicyUrl?: string
  totpSecret?: string
}

export async function registerLinkedInApp(
  options: LinkedInRegistrationOptions
): Promise<LinkedInAppResult> {
  const sessionDir = getSessionDir('linkedin')

  if (!isSessionValid('linkedin')) {
    throw new Error('LinkedIn session not valid. Run bootstrap-session.ts linkedin first.')
  }

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: true,
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()

  try {
    await page.goto('https://www.linkedin.com/developers/apps/new', { waitUntil: 'networkidle' })

    // Handle 2FA if prompted
    const twoFAField = page.locator('input[name="pin"], input[placeholder*="verification"]').first()
    if (await twoFAField.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (!options.totpSecret) {
        throw new Error('LinkedIn requires 2FA but no TOTP secret provided.')
      }
      const code = await generateTotpCode(options.totpSecret)
      await twoFAField.fill(code)
      await page.click('button[type="submit"]')
      await page.waitForTimeout(2000)
    }

    // Fill app name
    await page.fill('input[id*="name"], input[placeholder*="App name"]', options.appName)

    // Company selection (type NuStack)
    const companyInput = page.locator('input[placeholder*="company"], input[id*="company"]').first()
    if (await companyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await companyInput.fill(options.companyName ?? 'NuStack')
      await page.waitForTimeout(1500)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
    }

    // Privacy policy
    const privacyInput = page.locator('input[placeholder*="privacy"], input[id*="privacy"]').first()
    if (await privacyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await privacyInput.fill(options.privacyPolicyUrl ?? 'https://fanout.digital/privacy')
    }

    // Accept terms
    const termsCheckbox = page.locator('input[type="checkbox"]').first()
    if (await termsCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await termsCheckbox.check()
    }

    // Submit
    await page.click('button[type="submit"]:has-text("Create app"), button:has-text("Create app")')
    await page.waitForNavigation({ timeout: 15000 }).catch(() => null)

    // Go to Auth tab
    const authTab = page.locator('a:has-text("Auth"), [role="tab"]:has-text("Auth")')
    await authTab.waitFor({ timeout: 10000 })
    await authTab.click()
    await page.waitForTimeout(2000)

    // Add redirect URL
    const addRedirectBtn = page.locator('button:has-text("Add redirect"), a:has-text("Add redirect")')
    if (await addRedirectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addRedirectBtn.click()
      const redirectInput = page.locator('input[placeholder*="redirect"]').last()
      await redirectInput.fill(options.callbackUrl)
      await page.click('button:has-text("Update"), button:has-text("Save")')
      await page.waitForTimeout(2000)
    }

    // Extract credentials
    const clientId = await page.locator('[data-test-id="client-id"], .client-id, code').first().textContent() ?? ''
    const clientSecret = await page.locator('[data-test-id="client-secret"] button:has-text("Show"), .client-secret button').first()
      .click()
      .then(() => page.locator('[data-test-id="client-secret"] code, .client-secret code').first().textContent())
      .catch(async () => await page.locator('code').nth(1).textContent() ?? '')

    return {
      clientId: clientId.trim(),
      clientSecret: (typeof clientSecret === 'string' ? clientSecret : '').trim(),
      appName: options.appName,
    }
  } finally {
    await browser.close()
  }
}
