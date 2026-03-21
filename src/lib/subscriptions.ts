import { supabase } from '@/lib/supabase'

export type PlanKey = 'trial' | 'starter' | 'agency' | 'white-label'
export type SubStatus = 'trialing' | 'active' | 'expired' | 'canceled'

export interface OrgSubscription {
  id: string
  org_id: string
  plan_key: PlanKey
  status: SubStatus
  trial_started_at: string
  trial_expires_at: string
  activated_at: string | null
  expires_at: string | null
  square_order_id: string | null
  created_at: string
  updated_at: string
}

export const PLAN_LIMITS: Record<PlanKey, number> = {
  trial: 1,
  starter: 3,
  agency: 25,
  'white-label': Infinity,
}

export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  const { data } = await supabase
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .single()
  return data as OrgSubscription | null
}

export async function getOrCreateOrgSubscription(orgId: string): Promise<OrgSubscription> {
  const existing = await getOrgSubscription(orgId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('org_subscriptions')
    .insert({ org_id: orgId })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create org subscription: ${error?.message ?? 'unknown'}`)
  }
  return data as OrgSubscription
}

export function isTrialExpired(sub: OrgSubscription): boolean {
  if (sub.status !== 'trialing') return false
  return new Date(sub.trial_expires_at) < new Date()
}

export function getTrialDaysLeft(sub: OrgSubscription): number {
  if (sub.status !== 'trialing') return 0
  const ms = new Date(sub.trial_expires_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export function isSubscriptionActive(sub: OrgSubscription): boolean {
  if (sub.status === 'trialing') return !isTrialExpired(sub)
  if (sub.status === 'active') {
    if (!sub.expires_at) return true
    return new Date(sub.expires_at) > new Date()
  }
  return false
}

export function getProfileLimit(sub: OrgSubscription): number {
  return PLAN_LIMITS[sub.plan_key] ?? 1
}

export async function checkProfileLimit(
  orgId: string
): Promise<{ allowed: boolean; limit: number; current: number; plan: PlanKey; paywalled: boolean }> {
  const sub = await getOrCreateOrgSubscription(orgId)

  if (isTrialExpired(sub)) {
    return { allowed: false, limit: 0, current: 0, plan: sub.plan_key, paywalled: true }
  }

  if (!isSubscriptionActive(sub)) {
    return { allowed: false, limit: 0, current: 0, plan: sub.plan_key, paywalled: true }
  }

  const limit = getProfileLimit(sub)

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const current = count ?? 0
  const allowed = limit === Infinity ? true : current < limit

  return { allowed, limit, current, plan: sub.plan_key, paywalled: false }
}

export async function upsertActiveSubscription(
  orgId: string,
  planKey: PlanKey,
  squareOrderId: string
): Promise<void> {
  const { error } = await supabase
    .from('org_subscriptions')
    .upsert(
      {
        org_id: orgId,
        plan_key: planKey,
        status: 'active',
        activated_at: new Date().toISOString(),
        square_order_id: squareOrderId,
      },
      { onConflict: 'org_id' }
    )

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`)
  }
}
