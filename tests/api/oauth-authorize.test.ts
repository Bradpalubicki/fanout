import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const src = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/oauth/[platform]/authorize/route.ts'),
  'utf-8'
)
const grid = fs.readFileSync(
  path.join(process.cwd(), 'src/components/dashboard/platform-grid.tsx'),
  'utf-8'
)

/**
 * Meta silently re-approves a prior consent: no screen, no Page picker. If the
 * first grant included zero Pages, every later reconnect returns a valid token
 * with all scopes and an empty /me/accounts — permanently, with no way to fix
 * it from inside the product. Observed live 2026-09-23 across three attempts.
 */
describe('Meta authorize forces the Page picker', () => {
  it('sends auth_type=rerequest for facebook, instagram and threads', () => {
    expect(src).toMatch(/auth_type['"]?,\s*['"]rerequest['"]/)
    const guard = src.slice(
      src.indexOf("platform === 'facebook' || platform === 'instagram' || platform === 'threads'")
    )
    expect(guard).toMatch(/auth_type/)
  })

  it('still sets prompt=consent for youtube (refresh tokens)', () => {
    expect(src).toMatch(/prompt['"]?,\s*['"]consent['"]/)
  })

  it('keeps PKCE on twitter', () => {
    expect(src).toMatch(/code_challenge/)
  })
})

describe('a Meta token with no Page is escapable', () => {
  /**
   * "Finish setup" alone was a dead end: with zero Pages granted the picker is
   * permanently empty and there was no Disconnect or Reconnect to recover with.
   */
  it('offers a reconnect path alongside Finish setup', () => {
    const start = grid.indexOf('{awaitingPage ? (')
    const block = grid.slice(start, grid.indexOf(') : isConnected ? (', start))
    expect(block).toMatch(/Finish setup/)
    expect(block).toMatch(/Reconnect/)
    expect(block).toMatch(/handleOAuthConnect/)
  })
})
