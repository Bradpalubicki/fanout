import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getOrCreateOrgSubscription, isTrialExpired } from '@/lib/subscriptions'
import { UpgradeButton } from './billing-client'

export const metadata: Metadata = {
  title: 'Billing — Fanout',
  robots: { index: false, follow: false },
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/mo',
    profiles: 3,
    platforms: 5,
    ai: false,
    highlight: false,
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '$199',
    period: '/mo',
    profiles: 25,
    platforms: 9,
    ai: true,
    highlight: true,
  },
  {
    key: 'white-label',
    name: 'White-Label',
    price: '$399',
    period: '/mo',
    profiles: Infinity,
    platforms: 9,
    ai: true,
    highlight: false,
  },
] as const

export default async function BillingPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/sign-in')

  const sub = await getOrCreateOrgSubscription(orgId)
  const trialExpired = isTrialExpired(sub)

  const trialDaysLeft = sub.status === 'trialing'
    ? Math.max(0, Math.ceil((new Date(sub.trial_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  const planLabel: Record<string, string> = {
    trial: 'Free Trial',
    starter: 'Starter',
    agency: 'Agency',
    'white-label': 'White-Label',
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Billing</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your Fanout subscription</p>
      </div>

      {/* Current plan */}
      <Card className="p-5 border-gray-100 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Current Plan</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-black">{planLabel[sub.plan_key] ?? sub.plan_key}</span>
              <Badge className={sub.status === 'active' ? 'bg-green-100 text-green-700' : trialExpired ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}>
                {sub.status === 'active' ? 'Active' : trialExpired ? 'Expired' : 'Trial'}
              </Badge>
            </div>
          </div>
          {sub.status === 'trialing' && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 shrink-0" />
              {trialExpired
                ? <span className="text-red-600 font-medium">Trial expired</span>
                : <span><strong className="text-black">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> left in trial</span>}
            </div>
          )}
        </div>

        {trialExpired && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center gap-2">
            <Zap className="w-4 h-4 shrink-0" />
            Your trial has expired. Upgrade to continue posting to social media.
          </div>
        )}
      </Card>

      {/* Plan cards */}
      <h2 className="text-sm font-semibold text-black mb-4">Choose a plan</h2>
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {PLANS.map(plan => {
          const isCurrent = sub.plan_key === plan.key && sub.status === 'active'
          return (
            <Card key={plan.key} className={`p-5 border flex flex-col gap-4 ${plan.highlight ? 'border-black ring-1 ring-black' : 'border-gray-100'}`}>
              <div>
                {plan.highlight && (
                  <Badge className="bg-black text-white text-xs mb-2">Most popular</Badge>
                )}
                <div className="font-bold text-black text-base">{plan.name}</div>
                <div className="flex items-baseline gap-0.5 mt-1">
                  <span className="text-2xl font-black text-black">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  {plan.profiles === Infinity ? 'Unlimited profiles' : `${plan.profiles} profiles`}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  {plan.platforms === 9 ? 'All 9 platforms' : `${plan.platforms} platforms`}
                </li>
                {plan.ai && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    AI content generation
                  </li>
                )}
                {plan.key === 'white-label' && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    Custom domain
                  </li>
                )}
              </ul>
              {isCurrent ? (
                <div className="text-center text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg py-2 font-medium">
                  Current plan
                </div>
              ) : (
                <UpgradeButton plan={plan.key} highlight={plan.highlight} />
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        Payments processed securely by Square. Cancel anytime.
        Questions? <a href="mailto:brad@nustack.digital" className="underline">brad@nustack.digital</a>
      </p>
    </div>
  )
}
