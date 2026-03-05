import { chromium } from '@playwright/test'
import { getSessionDir, isSessionValid } from '@/lib/playwright-sessions'
import { generateTotpCode } from '@/lib/oauth-registration/totp'

export interface YouTubeAppResult {
  clientId: string
  clientSecret: string
  projectId: string
}

export interface YouTubeRegistrationOptions {
  projectName: string
  callbackUrl: string
  totpSecret?: string
}

export async function registerYouTubeApp(
  options: YouTubeRegistrationOptions
): Promise<YouTubeAppResult> {
  const sessionDir = getSessionDir('youtube')

  if (!isSessionValid('youtube')) {
    throw new Error('YouTube/Google session not valid. Run bootstrap-session.ts youtube first.')
  }

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: true,
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()

  try {
    // Step 1: Create/select project
    await page.goto('https://console.cloud.google.com/projectcreate', { waitUntil: 'networkidle' })

    // Handle 2FA if prompted
    const twoFAField = page.locator('input[type="tel"], input[placeholder*="code"]').first()
    if (await twoFAField.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (!options.totpSecret) {
        throw new Error('Google requires 2FA but no TOTP secret provided.')
      }
      const code = await generateTotpCode(options.totpSecret)
      await twoFAField.fill(code)
      await page.click('button:has-text("Next")')
      await page.waitForTimeout(2000)
    }

    const projectNameInput = page.locator('input[placeholder*="project name"], #p-name').first()
    if (await projectNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectNameInput.clear()
      await projectNameInput.fill(options.projectName)
      await page.click('button:has-text("Create")')
      await page.waitForTimeout(5000)
    }

    // Step 2: Enable YouTube Data API v3
    await page.goto(
      'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
      { waitUntil: 'networkidle' }
    )

    const enableBtn = page.locator('button:has-text("Enable")')
    if (await enableBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enableBtn.click()
      await page.waitForTimeout(3000)
    }

    // Step 3: Create OAuth 2.0 credentials
    await page.goto(
      'https://console.cloud.google.com/apis/credentials/oauthclient',
      { waitUntil: 'networkidle' }
    )

    // Select Web Application
    const appTypeSelect = page.locator('select, [role="listbox"]').first()
    if (await appTypeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.selectOption('select', 'web')
      await page.waitForTimeout(500)
    }

    // Set name
    const nameInput = page.locator('input[placeholder*="name"]').first()
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill(options.projectName)
    }

    // Add redirect URI
    await page.click('button:has-text("Add URI"), button:has-text("+ Add")')
    const redirectInput = page.locator('input[placeholder*="URI"]').last()
    await redirectInput.fill(options.callbackUrl)

    // Create
    await page.click('button:has-text("Create")')
    await page.waitForTimeout(3000)

    // Extract credentials from modal
    const clientId = await page.locator('[data-testid="client-id"], .client-id-value, code').first().textContent() ?? ''
    const clientSecret = await page.locator('[data-testid="client-secret"], .client-secret-value, code').nth(1).textContent() ?? ''

    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      projectId: options.projectName.toLowerCase().replace(/\s+/g, '-'),
    }
  } finally {
    await browser.close()
  }
}
