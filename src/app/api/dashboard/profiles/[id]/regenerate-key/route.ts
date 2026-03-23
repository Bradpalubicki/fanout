export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { generateApiKey, hashApiKey } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify profile belongs to org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const newKey = generateApiKey()
  const newHash = hashApiKey(newKey)

  const { error } = await supabase
    .from('profiles')
    .update({ api_key_hash: newHash })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to regenerate key' }, { status: 500 })
  }

  return NextResponse.json({ apiKey: newKey })
}
