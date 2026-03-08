import { verifyToken } from '@clerk/backend'

export async function getMobileUser(req: Request) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    return { userId: payload.sub, orgId: payload.org_id as string }
  } catch { return null }
}
