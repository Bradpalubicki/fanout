import { auth, clerkClient } from '@clerk/nextjs/server'

/**
 * True only for NuStack staff — either a server-to-server admin key or a Clerk
 * session whose primary email is @nustack.digital.
 *
 * Single definition on purpose: this predicate previously existed as two
 * identical copies, while three other internal routes had no check at all.
 *
 * The admin-key comparison requires a NON-EMPTY configured key. Comparing a
 * header directly against process.env fails OPEN when the var is unset
 * (undefined === undefined), so the guard is mandatory, not defensive.
 */
export async function isNuStackAdmin(adminKeyHeader?: string | null): Promise<boolean> {
  const configuredKey = process.env.FANOUT_ADMIN_KEY
  if (configuredKey && adminKeyHeader && adminKeyHeader === configuredKey) return true

  const { userId } = await auth()
  if (!userId) return false

  const clerk = await clerkClient()
  const user = await clerk.users.getUser(userId)
  return user.primaryEmailAddress?.emailAddress?.endsWith('@nustack.digital') ?? false
}
