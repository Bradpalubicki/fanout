export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, orgId } = user
  if (!orgId) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  // Admin only
  const clerk = await clerkClient()
  const memberships = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
  const currentMembership = memberships.data.find((m) => m.publicUserData?.userId === userId)
  if (currentMembership?.role !== 'org:admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 })
  }

  // Get all org profile IDs for post counting
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map((p) => p.id as string)

  // Month start
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Posts this month grouped by created_by
  const { data: monthPosts } = profileIds.length
    ? await supabase
        .from('posts')
        .select('created_by, created_at')
        .in('profile_id', profileIds)
        .gte('created_at', monthStart)
        .not('created_by', 'is', null)
    : { data: [] }

  // Posts per user + last active
  const postCountMap: Record<string, number> = {}
  const lastActiveMap: Record<string, string> = {}

  for (const post of monthPosts ?? []) {
    const uid = post.created_by as string
    postCountMap[uid] = (postCountMap[uid] ?? 0) + 1
    const createdAt = post.created_at as string
    if (!lastActiveMap[uid] || createdAt > lastActiveMap[uid]) {
      lastActiveMap[uid] = createdAt
    }
  }

  // Also check all-time for lastActive (posts beyond month start)
  const allMemberIds = memberships.data
    .map((m) => m.publicUserData?.userId)
    .filter(Boolean) as string[]

  const { data: allTimePosts } = profileIds.length
    ? await supabase
        .from('posts')
        .select('created_by, created_at')
        .in('profile_id', profileIds)
        .in('created_by', allMemberIds)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }

  for (const post of allTimePosts ?? []) {
    const uid = post.created_by as string
    const createdAt = post.created_at as string
    if (!lastActiveMap[uid] || createdAt > lastActiveMap[uid]) {
      lastActiveMap[uid] = createdAt
    }
  }

  const members = memberships.data.map((m) => {
    const uid = m.publicUserData?.userId ?? ''
    const firstName = m.publicUserData?.firstName ?? ''
    const lastName = m.publicUserData?.lastName ?? ''
    const name = ([firstName, lastName].filter(Boolean).join(' ') || m.publicUserData?.identifier) ?? uid
    return {
      userId: uid,
      name,
      email: m.publicUserData?.identifier ?? '',
      role: m.role as 'org:admin' | 'org:member',
      postsThisMonth: postCountMap[uid] ?? 0,
      lastActive: lastActiveMap[uid] ?? null,
    }
  })

  return NextResponse.json({ members })
}
