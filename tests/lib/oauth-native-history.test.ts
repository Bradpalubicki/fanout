import { describe, it, expect } from 'vitest'
import { OAUTH_CONFIGS } from '@/lib/oauth-config'

const entries = Object.entries(OAUTH_CONFIGS)

/**
 * `nativeHistory` declares whether the granted scopes let us read posts the
 * account created OUTSIDE Fanout. Public "supported platforms" copy is meant to
 * be derived from it, so an inconsistent entry becomes a false marketing claim.
 *
 * The paired-field invariant is not theoretical: during the 2026-09-23 edit,
 * reddit briefly held `nativeHistory: false` with a null blocker — a platform
 * silently excluded for no stated reason. These tests make that state fail.
 */
describe('nativeHistory declarations', () => {
  it('covers every configured platform', () => {
    expect(entries.length).toBeGreaterThan(10)
    for (const [name, cfg] of entries) {
      expect(typeof cfg.nativeHistory, `${name} missing nativeHistory`).toBe('boolean')
    }
  })

  it('always states a reason when native history is unavailable', () => {
    for (const [name, cfg] of entries) {
      if (!cfg.nativeHistory) {
        expect(cfg.nativeHistoryBlocker, `${name} is false but gives no blocker`).toBeTruthy()
        expect((cfg.nativeHistoryBlocker ?? '').length).toBeGreaterThan(15)
      }
    }
  })

  it('never states a blocker when native history IS available', () => {
    for (const [name, cfg] of entries) {
      if (cfg.nativeHistory) {
        expect(cfg.nativeHistoryBlocker, `${name} is true but names a blocker`).toBeNull()
      }
    }
  })

  /**
   * LinkedIn's r_member_social is a CLOSED permission. Requesting an unapproved
   * scope fails the ENTIRE authorization, so adding it speculatively would break
   * LinkedIn sign-in rather than merely degrade history.
   */
  it('does not request LinkedIn r_member_social, and marks it unavailable', () => {
    const li = OAUTH_CONFIGS.linkedin
    expect(li.scopes).not.toContain('r_member_social')
    expect(li.nativeHistory).toBe(false)
    expect(li.nativeHistoryBlocker).toMatch(/closed/i)
  })

  /**
   * Adding a scope after accounts connect forces every one of them to
   * re-consent. video.list must therefore be present BEFORE clients connect.
   */
  it('requests TikTok video.list so native history needs no later re-consent', () => {
    expect(OAUTH_CONFIGS.tiktok.scopes).toContain('video.list')
    expect(OAUTH_CONFIGS.tiktok.nativeHistory).toBe(true)
  })

  // A platform claiming native history must hold a scope that can read.
  it('every nativeHistory platform holds a read-capable scope', () => {
    const READ_HINTS = /read|list|basic|manage|youtube|business/i
    for (const [name, cfg] of entries) {
      if (!cfg.nativeHistory) continue
      // bluesky needs no grant: its author feed is public.
      if (name === 'bluesky') continue
      const hasRead = cfg.scopes.some((s) => READ_HINTS.test(s))
      expect(hasRead, `${name} claims native history but holds no read-capable scope`).toBe(true)
    }
  })
})
