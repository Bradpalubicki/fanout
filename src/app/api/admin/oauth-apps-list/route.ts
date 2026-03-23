export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'


async function isNuStackAdmin(req: NextRequest): Promise<boolean> {
  // Accept server-to-server admin key
  if (req.headers.get('x-admin-key') === process.env.FANOUT_ADMIN_KEY) return true
  // Accept Clerk session from @nustack.digital users
  const { userId } = await auth()
  if (!userId) return false
  const clerk = await clerkClient()
  const user = await clerk.users.getUser(userId)
  return user.primaryEmailAddress?.emailAddress?.endsWith('@nustack.digital') ?? false
}

export async function GET(req: NextRequest) {
  if (!(await isNuStackAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('oauth_app_credentials')
    .select('platform, client_id, app_name, status, registered_at, last_verified, notes')
    .order('platform')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
