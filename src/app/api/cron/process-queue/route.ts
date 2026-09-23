export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest'

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  const now = new Date().toISOString()

  // Find scheduled posts that are due
  const { data: duePosts } = await supabase
    .from('posts')
    .select('id, profile_id, platforms')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .not('scheduled_for', 'is', null)
    .limit(20)

  if (!duePosts?.length) {
    return NextResponse.json({ processed: 0 })
  }

  const events = duePosts.map((post) => ({
    name: 'social/post.created' as const,
    data: {
      postId: post.id,
      profileId: post.profile_id as string,
      platforms: post.platforms as string[],
    },
  }))

  await inngest.send(events)

  return NextResponse.json({ processed: duePosts.length })
}
