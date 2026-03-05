'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle, Clock, AlertCircle, RefreshCw, Plus, ExternalLink } from 'lucide-react'
import { PLATFORM_AUTOMATION, type PlatformKey } from '@/lib/oauth-registration/automation-support'

interface OAuthAppCredential {
  platform: string
  client_id: string | null
  app_name: string | null
  status: string
  registered_at: string | null
  last_verified: string | null
  notes: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
  if (status === 'review_required') return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Under Review</Badge>
  if (status === 'error') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Error</Badge>
  return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Pending</Badge>
}

export default function OAuthAppsAdminPage() {
  const { user, isLoaded } = useUser()
  const [credentials, setCredentials] = useState<OAuthAppCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [manualPlatform, setManualPlatform] = useState<string | null>(null)
  const [manualClientId, setManualClientId] = useState('')
  const [manualClientSecret, setManualClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)

  const isAdmin = isLoaded && (
    user?.primaryEmailAddress?.emailAddress?.endsWith('@nustack.digital') ?? false
  )

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      redirect('/dashboard')
    }
  }, [isLoaded, isAdmin])

  useEffect(() => {
    if (isAdmin) fetchCredentials()
  }, [isAdmin])

  async function fetchCredentials() {
    setLoading(true)
    const res = await fetch('/api/admin/oauth-apps-list', {
      headers: { 'x-admin-key': process.env.NEXT_PUBLIC_FANOUT_ADMIN_KEY ?? '' },
    })
    if (res.ok) {
      const data = await res.json() as OAuthAppCredential[]
      setCredentials(data)
    }
    setLoading(false)
  }

  async function handleAutoRegister(platform: string) {
    setRegistering(platform)
    const res = await fetch('/api/admin/register-oauth-app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': process.env.NEXT_PUBLIC_FANOUT_ADMIN_KEY ?? '',
      },
      body: JSON.stringify({
        platform,
        appName: 'Fanout',
        callbackUrl: `https://fanout.digital/api/oauth/${platform}/callback`,
      }),
    })
    setRegistering(null)
    await fetchCredentials()
    if (!res.ok) {
      const err = await res.json() as { error: string }
      alert(`Registration failed: ${err.error}`)
    }
  }

  async function handleManualSave() {
    if (!manualPlatform) return
    setSaving(true)
    await fetch('/api/admin/register-oauth-app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': process.env.NEXT_PUBLIC_FANOUT_ADMIN_KEY ?? '',
      },
      body: JSON.stringify({
        platform: manualPlatform,
        appName: 'Fanout',
        callbackUrl: `https://fanout.digital/api/oauth/${manualPlatform}/callback`,
        clientId: manualClientId,
        clientSecret: manualClientSecret,
      }),
    })
    setSaving(false)
    setManualPlatform(null)
    setManualClientId('')
    setManualClientSecret('')
    await fetchCredentials()
  }

  if (!isLoaded || !isAdmin) return null

  const credentialMap = Object.fromEntries(credentials.map((c) => [c.platform, c]))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">OAuth App Credentials</h1>
          <p className="text-sm text-gray-400 mt-1">Manage developer app registrations for all 9 platforms</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCredentials}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3">
        {(Object.keys(PLATFORM_AUTOMATION) as PlatformKey[]).map((platform) => {
          const config = PLATFORM_AUTOMATION[platform]
          const cred = credentialMap[platform]
          const status = cred?.status ?? 'pending'
          const isActive = status === 'active'

          return (
            <Card key={platform} className="bg-black border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {isActive
                        ? <CheckCircle className="h-5 w-5 text-green-400" />
                        : status === 'error'
                          ? <AlertCircle className="h-5 w-5 text-red-400" />
                          : <Clock className="h-5 w-5 text-gray-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                        <StatusBadge status={status} />
                        {config.canAutomate && (
                          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                            Auto-registerable
                          </Badge>
                        )}
                        {config.hasReview && (
                          <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                            Review required
                          </Badge>
                        )}
                      </div>
                      {cred?.client_id && (
                        <p className="text-xs text-gray-500 mt-1">
                          Client ID: {cred.client_id.slice(0, 8)}••••••••
                        </p>
                      )}
                      {cred?.notes && (
                        <p className="text-xs text-gray-500 mt-0.5">{cred.notes}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">{config.notes}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => window.open(config.devPortalUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Portal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setManualPlatform(platform)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Manual
                    </Button>
                    {config.canAutomate && !isActive && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-white text-black hover:bg-gray-200"
                        onClick={() => handleAutoRegister(platform)}
                        disabled={registering === platform}
                      >
                        {registering === platform ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : null}
                        Auto-Register
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-black border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Session Bootstrap Guide</CardTitle>
          <CardDescription>
            One-time setup per platform. Run once, sessions last 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-white/5 rounded p-3 overflow-x-auto text-gray-300">
{`# Bootstrap a session for Reddit (no 2FA — fastest)
npx ts-node scripts/bootstrap-session.ts reddit

# Bootstrap Twitter (needs TOTP set up first)
npx ts-node scripts/bootstrap-session.ts twitter

# After bootstrap, auto-register all automatable platforms:
curl -X POST https://fanout.digital/api/admin/check-oauth-apps \\
  -H "x-admin-key: YOUR_ADMIN_KEY"`}
          </pre>
        </CardContent>
      </Card>

      {/* Manual Entry Dialog */}
      <Dialog open={!!manualPlatform} onOpenChange={() => setManualPlatform(null)}>
        <DialogContent className="bg-black border-white/20">
          <DialogHeader>
            <DialogTitle>Enter {manualPlatform ? PLATFORM_LABELS[manualPlatform] : ''} Credentials</DialogTitle>
            <DialogDescription>
              Paste the Client ID and Secret from the developer portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Client ID</label>
              <Input
                value={manualClientId}
                onChange={(e) => setManualClientId(e.target.value)}
                placeholder="Enter client ID..."
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Client Secret</label>
              <Input
                value={manualClientSecret}
                onChange={(e) => setManualClientSecret(e.target.value)}
                placeholder="Enter client secret..."
                type="password"
                className="bg-white/5 border-white/10"
              />
            </div>
            <Button
              className="w-full bg-white text-black hover:bg-gray-200"
              onClick={handleManualSave}
              disabled={saving || !manualClientId || !manualClientSecret}
            >
              {saving ? 'Saving...' : 'Save Credentials'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
