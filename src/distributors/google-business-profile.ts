import { BaseDistributor, type PostPayload, type PostResult, type RefreshResult } from './base'
import type { AnalyticsSnapshot } from '@/lib/types'

// Google My Business (Business Profile) API v4
// POST /accounts/{accountName}/locations/{locationName}/localPosts
// Scopes: https://www.googleapis.com/auth/business.manage

export class GoogleBusinessProfileDistributor extends BaseDistributor {
  platform = 'google_business_profile'

  private async getAccountLocation(accessToken: string): Promise<{ accountName: string; locationName: string } | null> {
    // List accounts
    const { ok: acOk, data: acData } = await this.fetchJson<{
      accounts?: { name: string }[]
    }>('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!acOk || !acData.accounts?.length) return null
    const accountName = acData.accounts[0].name

    // List locations for first account
    const { ok: locOk, data: locData } = await this.fetchJson<{
      locations?: { name: string }[]
    }>(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!locOk || !locData.locations?.length) return null
    return { accountName, locationName: locData.locations[0].name }
  }

  async post(_payload: PostPayload, _accessToken: string, _pageId?: string): Promise<PostResult> {
    // The mybusiness.googleapis.com/v4/localPosts API has been fully deprecated and removed.
    // Google migrated to the Business Profile API v1, but the local posts endpoint
    // has not been made available in the new API.
    // See: https://developers.google.com/my-business/content/overview
    // TODO: Re-implement when Google provides a v1 posts endpoint or use the
    // Google Business Profile Performance API for posting.
    return {
      success: false,
      error: 'Google Business Profile posting is temporarily unavailable — API migration in progress.',
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { ok, data } = await this.fetchJson<{
      access_token?: string
      expires_in?: number
      error?: string
    }>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.GBP_CLIENT_ID!,
        client_secret: process.env.GBP_CLIENT_SECRET!,
      }).toString(),
    })

    if (!ok || !data.access_token) {
      throw new Error(data.error ?? 'GBP token refresh failed')
    }

    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    }
  }

  async getAnalytics(
    _platformPostId: string,
    _accessToken: string
  ): Promise<Partial<AnalyticsSnapshot>> {
    // GBP local post insights not available via standard localPosts API
    return {}
  }
}
