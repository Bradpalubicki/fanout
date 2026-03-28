import { Suspense } from 'react'
import { SetupWizard } from './setup-wizard-client'

export const metadata = { title: 'Social Setup Wizard — Fanout' }

export default function SocialSetupPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Social Account Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect NuStack product accounts to all 13 social platforms. Some connect automatically — others need OAuth.
        </p>
      </div>
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading wizard...</div>}>
        <SetupWizard />
      </Suspense>
    </div>
  )
}
