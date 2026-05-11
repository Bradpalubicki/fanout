import { createBlueskyAccountForOrg } from './platforms/bluesky'
import { createPinterestAccountForOrg } from './platforms/pinterest'
import { createTwitterAccountForOrg } from './platforms/twitter'
import type { AccountCreationInput, AccountCreationResult } from './types'

export type { AccountCreationInput, AccountCreationResult }

export async function createAndConnectAccount(
  input: AccountCreationInput,
): Promise<AccountCreationResult> {
  switch (input.platform) {
    case 'bluesky':
      return createBlueskyAccountForOrg(input)
    case 'pinterest':
      return createPinterestAccountForOrg(input)
    case 'twitter':
      return createTwitterAccountForOrg(input)
    default: {
      const _exhaustive: never = input.platform
      return {
        platform: input.platform,
        success: false,
        error: `Unsupported platform: ${_exhaustive}`,
      }
    }
  }
}
