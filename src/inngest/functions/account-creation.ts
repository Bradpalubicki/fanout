import { inngest } from '@/lib/inngest'
import { createAndConnectAccount, type AccountCreationInput } from '@/agents/account-creation'

export const createAndConnectAccountFn = inngest.createFunction(
  {
    id: 'account-creation',
    retries: 2,
  },
  { event: 'fanout/account.create' },
  async ({ event, step }) => {
    const input = event.data as AccountCreationInput

    const result = await step.run('create-platform-account', async () => {
      return createAndConnectAccount(input)
    })

    return result
  },
)
