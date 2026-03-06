import { chromium } from '@playwright/test'
import { getSessionDir, isSessionValid } from '@/lib/playwright-sessions'

export interface RedditAppResult {
  clientId: string
  clientSecret: string
  appName: string
}

export interface RedditRegistrationOptions {
  appName: string
  callbackUrl: string
  description?: string
  totpSecret?: string
}

export async function registerRedditApp(
  options: RedditRegistrationOptions
): Promise<RedditAppResult> {
  const sessionDir = getSessionDir('reddit')

  if (!isSessionValid('reddit')) {
    throw new Error('Reddit session not valid. Run bootstrap-session.ts reddit first.')
  }

  const browser = await chromium.launchPersistentContext(sessionDir, {
    headless: true,
    args: ['--no-sandbox'],
  })

  const page = await browser.newPage()

  try {
    await page.goto('https://www.reddit.com/prefs/apps', { waitUntil: 'networkidle' })

    // Check if logged in
    const loginBtn = page.locator('a[href*="login"]').first()
    if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      throw new Error('Reddit session expired. Re-run bootstrap-session.ts reddit.')
    }

    // Check if app already exists
    const existingApps = await page.locator('.developed-app .app-name').allTextContents()
    const alreadyExists = existingApps.some(
      (name) => name.trim().toLowerCase() === options.appName.toLowerCase()
    )
    if (alreadyExists) {
      // Extract existing credentials
      const appRow = page.locator('.developed-app').filter({ hasText: options.appName }).first()
      const clientId = await appRow.locator('.app-clientID span').textContent() ?? ''
      const secretEl = appRow.locator('.secret span')
      const clientSecret = await secretEl.textContent() ?? ''
      return { clientId: clientId.trim(), clientSecret: clientSecret.trim(), appName: options.appName }
    }

    // Click "create another app" button
    const createBtn = page.locator('button:has-text("create another app"), button:has-text("create app")')
    await createBtn.first().click()

    // Fill in the form
    await page.fill('input[name="name"]', options.appName)
    await page.check('input[value="web"]') // web app type

    if (options.description) {
      await page.fill('textarea[name="description"]', options.description)
    }

    await page.fill('input[name="redirect_uri"]', options.callbackUrl)

    // Submit
    await page.click('button[type="submit"]:has-text("create app")')
    await page.waitForTimeout(2000)

    // Extract credentials from the newly created app
    const newApp = page.locator('.developed-app').filter({ hasText: options.appName }).first()
    await newApp.waitFor({ timeout: 5000 })

    const clientId = await newApp.locator('*:has-text("personal use script")').first()
      .evaluate((el) => el.previousSibling?.textContent ?? '')
      .catch(async () => {
        // Fallback: get the ID from the app header area
        return await newApp.locator('.app-clientID span, code').first().textContent() ?? ''
      })

    const secretEl = newApp.locator('.secret span, [id*="secret"] code')
    const clientSecret = await secretEl.first().textContent() ?? ''

    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      appName: options.appName,
    }
  } finally {
    await browser.close()
  }
}
