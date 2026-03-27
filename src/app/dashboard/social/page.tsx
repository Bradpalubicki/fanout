import { Suspense } from 'react'
import { SocialCommandCenter } from './social-client'

export const metadata = { title: 'Social Command Center — Fanout' }

export default function SocialPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Social Command Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          NuStack product social presence — CertusAudit, PocketPals, SiteGrade, Wellness Engine
        </p>
      </div>
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading...</div>}>
        <SocialCommandCenter />
      </Suspense>
    </div>
  )
}
