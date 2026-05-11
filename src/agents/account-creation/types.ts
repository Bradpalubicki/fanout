export type SupportedPlatform = 'bluesky' | 'pinterest' | 'twitter'

export interface AccountCreationInput {
  orgId: string
  platform: SupportedPlatform
  /** Human-readable client name used to generate handle candidates */
  clientName: string
  /** Used as account email on platforms that require it */
  clientEmail: string
}

export interface AccountCreationResult {
  platform: SupportedPlatform
  success: boolean
  /** e.g. "clientname.bsky.social" */
  handle?: string
  /** Platform-native user/DID identifier */
  platformId?: string
  error?: string
  /** True when the platform requires a human to complete OAuth or manual steps */
  requiresHumanStep?: boolean
  humanStepInstructions?: string
}
