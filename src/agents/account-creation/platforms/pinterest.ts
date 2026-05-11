/**
 * Pinterest account creation — v2 stub.
 * Pinterest requires user OAuth to grant API access; fully automated creation
 * is not supported by their public API. Human step required.
 */

import type { AccountCreationInput, AccountCreationResult } from '../types'

export async function createPinterestAccountForOrg(
  input: AccountCreationInput,
): Promise<AccountCreationResult> {
  return {
    platform: 'pinterest',
    success: false,
    requiresHumanStep: true,
    humanStepInstructions:
      'Pinterest requires the client to create their own account and authorize Fanout via OAuth. ' +
      `Send the OAuth connect URL to ${input.clientEmail} and ask them to complete the flow.`,
  }
}
