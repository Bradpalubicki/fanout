import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { getMobileUser } from '@/lib/mobile-auth'

async function getOrgRole(orgId: string, userId: string): Promise<string | null> {
  const clerk = await clerkClient()
  const memberships = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
  const membership = memberships.data.find((m) => m.publicUserData?.userId === userId)
  return membership?.role ?? null
}

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, orgId } = user
  if (!orgId) return NextResponse.json({ error: 'No org context' }, { status: 403 })

  const role = await getOrgRole(orgId, userId)

  // Get all org profile IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map((p) => p.id)
  const profileNameMap: Record<string, string> = {}
  for (const p of profiles ?? []) profileNameMap[p.id as string] = p.name as string

  const isAdmin = role === 'org:admin'

  // Pending approvals — admins only
  let pendingApprovals: Array<{
    id: string
    content: string
    platforms: string[]
    profileName: string
    authorName: string
    submittedAt: string
  }> = []

  if (isAdmin && profileIds.length) {
    const { data: pending } = await supabase
      .from('posts')
      .select('id, content, platforms, profile_id, created_by, created_at')
      .in('profile_id', profileIds)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true })
      .limit(50)

    // Collect author names from Clerk
    const authorIds = [...new Set((pending ?? []).map((p) => p.created_by as string).filter(Boolean))]
    const authorMap: Record<string, string> = {}
    const clerk = await clerkClient()
    await Promise.all(
      authorIds.map(async (uid) => {
        try {
          const u = await clerk.users.getUser(uid)
          authorMap[uid] = u.fullName ?? u.primaryEmailAddress?.emailAddress ?? uid
        } catch {
          authorMap[uid] = uid
        }
      })
    )

    pendingApprovals = (pending ?? []).map((p) => ({
      id: p.id as string,
      content: p.content as string,
      platforms: p.platforms as string[],
      profileName: profileNameMap[p.profile_id as string] ?? 'Unknown',
      authorName: authorMap[p.created_by as string] ?? (p.created_by as string) ?? 'Unknown',
      submittedAt: p.created_at as string,
    }))
  }

  // My submissions — members only
  let mySubmissions: Array<{
    id: string
    content: string
    platforms: string[]
    status: string
    reviewNote: string | null
    submittedAt: string
  }> = []

  if (!isAdmin && profileIds.length) {
    const { data: mine } = await supabase
      .from('posts')
      .select('id, content, platforms, status, review_note, created_at')
      .in('profile_id', profileIds)
      .eq('created_by', userId)
      .in('status', ['pending_approval', 'posted', 'failed', 'draft'])
      .order('created_at', { ascending: false })
      .limit(50)

    mySubmissions = (mine ?? []).map((p) => ({
      id: p.id as string,
      content: p.content as string,
      platforms: p.platforms as string[],
      status: p.status as string,
      reviewNote: (p.review_note as string | null) ?? null,
      submittedAt: p.created_at as string,
    }))
  }

  // Failed posts — admins only
  let failedPosts: Array<{
    id: string
    content: string
    platforms: string[]
    profileName: string
    errorSummary: string
  }> = []

  if (isAdmin && profileIds.length) {
    const { data: failed } = await supabase
      .from('posts')
      .select('id, content, platforms, profile_id')
      .in('profile_id', profileIds)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(20)

    const failedIds = (failed ?? []).map((p) => p.id as string)

    const { data: failedResults } = failedIds.length
      ? await supabase
          .from('post_results')
          .select('post_id, platform, error_message')
          .in('post_id', failedIds)
          .eq('status', 'failed')
      : { data: [] }

    const resultMap: Record<string, string> = {}
    for (const r of failedResults ?? []) {
      const postId = r.post_id as string
      if (!resultMap[postId]) {
        resultMap[postId] = (r.error_message as string | null) ?? 'Unknown error'
      }
    }

    failedPosts = (failed ?? []).map((p) => ({
      id: p.id as string,
      content: p.content as string,
      platforms: p.platforms as string[],
      profileName: profileNameMap[p.profile_id as string] ?? 'Unknown',
      errorSummary: resultMap[p.id as string] ?? 'Post failed to publish',
    }))
  }

  return NextResponse.json({ pendingApprovals, mySubmissions, failedPosts })
}
