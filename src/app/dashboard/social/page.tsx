import { Suspense } from 'react'
import Link from 'next/link'
import { SocialCommandCenter } from './social-client'

export const metadata = { title: 'Social Command Center — Fanout' }

export default function SocialPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Command Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            NuStack product social presence — CertusAudit, PocketPals, SiteGrade, Wellness Engine
          </p>
        </div>
        <Link
          href="/dashboard/social/setup"
          className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors text-gray-700"
        >
          Setup Accounts
        </Link>
      </div>
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading...</div>}>
        <SocialCommandCenter />
      </Suspense>
    </div>
  )
}
