import { NextResponse } from 'next/server'
import { getIntegrationAudit } from '@/lib/integration-status'
import { getSupabase } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Get queue stats
  const { data: queueStats } = await supabase
    .from('social_posts_queue')
    .select('status, platform, product')

  const stats = {
    pending: 0,
    posted: 0,
    failed: 0,
    byProduct: {} as Record<string, number>,
    byPlatform: {} as Record<string, number>,
  }

  for (const row of queueStats ?? []) {
    if (row.status === 'pending') stats.pending++
    if (row.status === 'posted') stats.posted++
    if (row.status === 'failed') stats.failed++
    stats.byProduct[row.product] = (stats.byProduct[row.product] ?? 0) + 1
    stats.byPlatform[row.platform] = (stats.byPlatform[row.platform] ?? 0) + 1
  }

  // Get connected accounts
  const { data: accounts } = await supabase
    .from('product_platform_accounts')
    .select('product, platform, account_handle, status, last_used_at')

  return NextResponse.json({
    integrations: getIntegrationAudit(),
    queue: stats,
    connectedAccounts: accounts ?? [],
  })
}
