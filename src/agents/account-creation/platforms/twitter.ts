/**
 * Twitter/X account creation — v2 stub.
 * Twitter does not provide an API for automated account creation.
 * Human step required.
 */

import type { AccountCreationInput, AccountCreationResult } from '../types'

export async function createTwitterAccountForOrg(
  input: AccountCreationInput,
): Promise<AccountCreationResult> {
  return {
    platform: 'twitter',
    success: false,
    requiresHumanStep: true,
    humanStepInstructions:
      'Twitter/X does not allow automated account creation. ' +
      `The client (${input.clientEmail}) must create their own account at twitter.com, ` +
      'then connect it to Fanout via the OAuth flow in their dashboard.',
  }
}
