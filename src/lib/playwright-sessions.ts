import path from 'path'
import fs from 'fs'
import type { PlatformKey } from '@/lib/oauth-registration/automation-support'

const SESSIONS_BASE = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? 'C:/Users/bradp',
  '.fanout-sessions'
)

export interface SessionConfig {
  platform: PlatformKey
  profileDir: string
  exists: boolean
}

export function getSessionDir(platform: PlatformKey): string {
  return path.join(SESSIONS_BASE, platform)
}

export function getSession(platform: PlatformKey): SessionConfig {
  const profileDir = getSessionDir(platform)
  return {
    platform,
    profileDir,
    exists: fs.existsSync(profileDir),
  }
}

export function isSessionValid(platform: PlatformKey): boolean {
  const profileDir = getSessionDir(platform)
  const markerFile = path.join(profileDir, 'session-valid')
  if (!fs.existsSync(markerFile)) return false

  try {
    const content = fs.readFileSync(markerFile, 'utf-8').trim()
    const validUntil = new Date(content)
    return validUntil > new Date()
  } catch {
    return false
  }
}

export function markSessionValid(platform: PlatformKey, daysValid: number = 30): void {
  const profileDir = getSessionDir(platform)
  fs.mkdirSync(profileDir, { recursive: true })
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + daysValid)
  fs.writeFileSync(path.join(profileDir, 'session-valid'), validUntil.toISOString())
}

export function invalidateSession(platform: PlatformKey): void {
  const markerFile = path.join(getSessionDir(platform), 'session-valid')
  if (fs.existsSync(markerFile)) {
    fs.unlinkSync(markerFile)
  }
}

export const PLATFORM_LOGIN_URLS: Record<PlatformKey, string> = {
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

export const PLATFORM_POST_LOGIN_PATTERNS: Record<PlatformKey, RegExp> = {
  reddit: /reddit\.com\/(r\/|user\/|prefs)/,
  twitter: /twitter\.com\/home|x\.com\/home/,
  linkedin: /linkedin\.com\/feed|linkedin\.com\/in\//,
  youtube: /myaccount\.google\.com|console\.cloud\.google\.com/,
  pinterest: /pinterest\.com\/[^/]+\/$/,
  tiktok: /tiktok\.com\/@/,
  facebook: /facebook\.com\/$/,
  instagram: /instagram\.com\/$/,
  threads: /threads\.net\/$/,
}
