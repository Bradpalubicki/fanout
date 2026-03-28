'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Key,
  Lock,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConnectResult {
  product: string
  platform: string
  status: 'connected' | 'skipped' | 'error' | 'no_creds'
  handle?: string
  message: string
}

interface AutoConnectResponse {
  results: ConnectResult[]
  summary: { connected: number; errors: number; no_creds: number; total: number }
}

interface EnvStatus {
  product: string
  platform: string
  has_creds: boolean
  env_vars: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRODUCTS = ['certusaudit', 'pocketpals', 'sitegrade', 'wellness-engine'] as const

const PRODUCT_LABELS: Record<string, string> = {
  certusaudit: 'CertusAudit',
  pocketpals: 'PocketPals',
  sitegrade: 'SiteGrade',
  'wellness-engine': 'Wellness Engine',
}

const OAUTH_PLATFORMS = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '𝕏',
    time: '45 min',
    difficulty: 'medium',
    steps: [
      'Go to developer.twitter.com → Create App',
      'Set permissions: Read and Write',
      'Callback URL: https://fanout.digital/api/oauth/twitter/callback',
      'Copy Client ID + Secret → Add to Vercel env vars:',
      'TWITTER_CLIENT_ID  and  TWITTER_CLIENT_SECRET',
      'Then click "Connect" below for each product',
    ],
    devLink: 'https://developer.twitter.com/en/portal/dashboard',
    envVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '🤖',
    time: '30 min (instant approval)',
    difficulty: 'easy',
    steps: [
      'Go to reddit.com/prefs/apps (logged in as brad@nustack.digital)',
      'Click "create another app" → choose "web app"',
      'Name: Fanout - Social Distribution',
      'Redirect URI: https://fanout.digital/api/oauth/reddit/callback',
      'Copy Client ID (under app name) + Secret → add to Vercel:',
      'REDDIT_CLIENT_ID  and  REDDIT_CLIENT_SECRET',
      'Then click "Connect" below for each product',
    ],
    devLink: 'https://www.reddit.com/prefs/apps',
    envVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶',
    time: '45 min',
    difficulty: 'medium',
    steps: [
      'Go to console.cloud.google.com → Create project: "Fanout Social API"',
      'Enable YouTube Data API v3',
      'Create OAuth 2.0 client → Web application',
      'Redirect URI: https://fanout.digital/api/oauth/youtube/callback',
      'Add to Vercel: YOUTUBE_CLIENT_ID  and  YOUTUBE_CLIENT_SECRET',
      'Then click "Connect" below for each product',
    ],
    devLink: 'https://console.cloud.google.com',
    envVars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'in',
    time: '45 min + 24–48hr review',
    difficulty: 'medium',
    steps: [
      'Go to linkedin.com/developers/apps/new',
      'Request "Share on LinkedIn" product (requires review)',
      'Redirect URI: https://fanout.digital/api/oauth/linkedin/callback',
      'Add to Vercel: LINKEDIN_CLIENT_ID  and  LINKEDIN_CLIENT_SECRET',
      'After approval: click "Connect" below for each product',
    ],
    devLink: 'https://www.linkedin.com/developers/apps',
    envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  },
]

const BLOCKED_PLATFORMS = [
  {
    name: 'Instagram',
    reason: 'Meta Business Verification pending (App ID: 772426605937002)',
    checkUrl: 'https://developers.facebook.com/apps/772426605937002',
    eta: 'Unknown — check Meta portal',
  },
  {
    name: 'Facebook',
    reason: 'Same Meta Business Verification as Instagram',
    checkUrl: 'https://developers.facebook.com/apps/772426605937002',
    eta: 'Unknown — check Meta portal',
  },
  {
    name: 'Threads',
    reason: 'Same Meta Business Verification as Instagram',
    checkUrl: 'https://developers.facebook.com/apps/772426605937002',
    eta: 'Unknown — check Meta portal',
  },
  {
    name: 'TikTok',
    reason: 'TikTok app review in progress',
    checkUrl: 'https://developers.tiktok.com',
    eta: '1–2 weeks',
  },
  {
    name: 'Pinterest',
    reason: 'Pinterest app review in progress',
    checkUrl: 'https://developers.pinterest.com',
    eta: '1–2 weeks',
  },
]

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Overview', 'Auto-Setup', 'OAuth Setup', 'Blocked', 'Done']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 mb-8 text-xs">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full font-medium text-xs
              ${i < current ? 'bg-green-500 text-white' : i === current ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}
          >
            {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={i === current ? 'font-medium text-gray-900' : 'text-gray-400'}>{label}</span>
          {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5" />}
        </div>
      ))}
    </div>
  )
}

// ─── Step 0: Overview ────────────────────────────────────────────────────────

function StepOverview({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>What this wizard does:</strong> Sets up social posting accounts for all 4 NuStack products across 13 platforms. Two layers — automatic and manual.
      </div>

      <div className="space-y-3">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
            <Zap className="w-4 h-4 text-green-500" />
            Layer 1 — Auto-Setup (2 min)
          </div>
          <p className="text-sm text-gray-600 mb-2">Bluesky and Mastodon connect automatically from environment variables. No OAuth flow needed.</p>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-700">Bluesky</Badge>
            <Badge className="bg-green-100 text-green-700">Mastodon</Badge>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
            <Key className="w-4 h-4 text-yellow-500" />
            Layer 2 — OAuth Setup (~2 hrs)
          </div>
          <p className="text-sm text-gray-600 mb-2">Twitter/X, Reddit, YouTube, LinkedIn need you to register a developer app and connect each product account via OAuth.</p>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-yellow-100 text-yellow-700">Twitter/X</Badge>
            <Badge className="bg-yellow-100 text-yellow-700">Reddit</Badge>
            <Badge className="bg-yellow-100 text-yellow-700">YouTube</Badge>
            <Badge className="bg-yellow-100 text-yellow-700">LinkedIn</Badge>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
            <Lock className="w-4 h-4 text-red-400" />
            Layer 3 — Waiting on Approvals
          </div>
          <p className="text-sm text-gray-600 mb-2">Meta (Instagram/Facebook/Threads) and TikTok are pending platform approvals you can&apos;t speed up.</p>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-red-100 text-red-600">Instagram</Badge>
            <Badge className="bg-red-100 text-red-600">Facebook</Badge>
            <Badge className="bg-red-100 text-red-600">Threads</Badge>
            <Badge className="bg-red-100 text-red-600">TikTok</Badge>
            <Badge className="bg-red-100 text-red-600">Pinterest</Badge>
          </div>
        </div>
      </div>

      <Button onClick={onNext} className="w-full">
        Start Setup <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  )
}

// ─── Step 1: Auto-Setup ──────────────────────────────────────────────────────

function StepAutoSetup({ onNext }: { onNext: () => void }) {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ConnectResult[] | null>(null)
  const [envStatus, setEnvStatus] = useState<EnvStatus[] | null>(null)
  const [summary, setSummary] = useState<AutoConnectResponse['summary'] | null>(null)

  async function checkEnvStatus() {
    try {
      const res = await fetch('/api/social-setup/auto-connect')
      if (res.ok) {
        const data = await res.json() as { status: EnvStatus[] }
        setEnvStatus(data.status)
      }
    } catch {
      // silent
    }
  }

  async function runAutoConnect() {
    setRunning(true)
    try {
      const res = await fetch('/api/social-setup/auto-connect', { method: 'POST' })
      const data = await res.json() as AutoConnectResponse
      setResults(data.results)
      setSummary(data.summary)
      if (data.summary.connected > 0) {
        toast.success(`${data.summary.connected} account(s) connected!`)
      }
    } catch (e) {
      toast.error(`Auto-connect failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRunning(false)
    }
  }

  // Load env status on first render
  useState(() => { checkEnvStatus() })

  const hasCreds = envStatus?.some((e) => e.has_creds) ?? false
  const missingAll = envStatus && envStatus.every((e) => !e.has_creds)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-500" />
          Auto-Setup: Bluesky + Mastodon
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Connects all 4 products to Bluesky and Mastodon using app credentials stored in Vercel env vars.
        </p>
      </div>

      {/* Env var status */}
      {envStatus && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b px-4 py-2 text-xs font-medium text-gray-600">
            Environment Variable Status
          </div>
          <div className="divide-y">
            {['bluesky', 'mastodon'].map((platform) => (
              <div key={platform}>
                <div className="px-4 py-2 bg-white text-xs font-medium text-gray-700 capitalize border-b">
                  {platform}
                </div>
                {envStatus.filter((e) => e.platform === platform).map((e) => (
                  <div key={`${e.product}-${e.platform}`} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{PRODUCT_LABELS[e.product] ?? e.product}</span>
                    <div className="flex items-center gap-2">
                      {e.has_creds ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Creds ready</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500 text-xs">No env vars</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {missingAll && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>No credentials found.</strong> Add Bluesky app passwords and Mastodon tokens to Vercel before running auto-setup.
          <div className="mt-2 font-mono text-xs space-y-1">
            {PRODUCTS.map((p) => {
              const k = p.toUpperCase().replace(/-/g, '_')
              return (
                <div key={p} className="text-amber-700">
                  BLUESKY_{k}_IDENTIFIER / BLUESKY_{k}_APP_PASSWORD<br />
                  MASTODON_{k}_ACCESS_TOKEN
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 border-b px-4 py-2 text-xs font-medium text-gray-600 flex items-center justify-between">
            <span>Results</span>
            {summary && (
              <span className="text-green-600">{summary.connected} connected · {summary.errors} errors · {summary.no_creds} missing creds</span>
            )}
          </div>
          <div className="divide-y">
            {results.map((r) => (
              <div key={`${r.product}-${r.platform}`} className="flex items-start gap-3 px-4 py-3 text-sm">
                <div className="mt-0.5 flex-shrink-0">
                  {r.status === 'connected' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {r.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                  {r.status === 'no_creds' && <Clock className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{PRODUCT_LABELS[r.product] ?? r.product}</span>
                  <span className="text-gray-400 mx-1">→</span>
                  <span className="capitalize">{r.platform}</span>
                  {r.handle && <span className="ml-2 text-gray-500 text-xs">{r.handle}</span>}
                  <p className="text-gray-500 text-xs mt-0.5">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={runAutoConnect}
          disabled={running || !hasCreds}
          className="flex-1"
        >
          {running ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />Run Auto-Connect</>
          )}
        </Button>
        <Button variant="outline" onClick={onNext}>
          {results ? 'Continue' : 'Skip'} <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: OAuth Setup ─────────────────────────────────────────────────────

function StepOAuthSetup({ onNext }: { onNext: () => void }) {
  const [expanded, setExpanded] = useState<string | null>('reddit')
  const [connecting, setConnecting] = useState<string | null>(null)

  async function connectPlatform(platform: string, product: string) {
    setConnecting(`${platform}-${product}`)
    try {
      // First, need a profile_id for this product — look it up or use a sentinel
      // For NuStack products, we use product name as the lookup key in product_platform_accounts
      // The OAuth flow needs a profileId — use the social setup profile
      const profileRes = await fetch(`/api/social-status`)
      const statusData = await profileRes.json() as { connectedAccounts: Array<{ product: string; platform: string }> }

      // Check if already connected
      const alreadyConnected = statusData.connectedAccounts?.some(
        (a) => a.product === product && a.platform === platform
      )

      if (alreadyConnected) {
        toast.success(`${PRODUCT_LABELS[product] ?? product} already connected to ${platform}`)
        return
      }

      // For OAuth to work, we need a Fanout profile ID
      // NuStack product accounts use a special "nustack-internal" org
      // Try to get the internal profile ID from the setup endpoint
      const profileLookup = await fetch(`/api/social-setup/product-profile?product=${product}`)
      if (!profileLookup.ok) {
        toast.error(`Could not find profile for ${product}. Make sure it exists in the DB.`)
        return
      }
      const { profile_id } = await profileLookup.json() as { profile_id: string }

      // Redirect to OAuth authorize
      window.location.href = `/api/oauth/${platform}/authorize?profileId=${profile_id}`
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Key className="w-5 h-5 text-yellow-500" />
          OAuth Setup: Twitter, Reddit, YouTube, LinkedIn
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Each platform requires a developer app. Register the app, add env vars to Vercel, then connect each product below.
        </p>
      </div>

      <div className="space-y-3">
        {OAUTH_PLATFORMS.map((platform) => (
          <div key={platform.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === platform.id ? null : platform.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold">
                  {platform.icon}
                </span>
                <div>
                  <div className="font-medium text-gray-900">{platform.name}</div>
                  <div className="text-xs text-gray-400">{platform.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={
                  platform.difficulty === 'easy' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }>
                  {platform.difficulty}
                </Badge>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded === platform.id ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {expanded === platform.id && (
              <div className="border-t px-4 py-4 bg-gray-50 space-y-4">
                {/* Steps */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Setup Steps</div>
                  <ol className="space-y-1.5">
                    {platform.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 bg-white border rounded-full flex items-center justify-center text-xs font-medium text-gray-500">
                          {i + 1}
                        </span>
                        <span className={step.includes('TWITTER_') || step.includes('REDDIT_') || step.includes('YOUTUBE_') || step.includes('LINKEDIN_') ? 'font-mono text-xs bg-white border rounded px-1 py-0.5 text-gray-700' : 'text-gray-700'}>
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Dev portal link */}
                <a
                  href={platform.devLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
                >
                  Open {platform.name} Developer Portal <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {/* Connect per-product */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Connect Products (after adding env vars)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PRODUCTS.map((product) => (
                      <button
                        key={product}
                        onClick={() => connectPlatform(platform.id, product)}
                        disabled={connecting === `${platform.id}-${product}`}
                        className="flex items-center justify-between bg-white border rounded-md px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        <span className="text-gray-700">{PRODUCT_LABELS[product]}</span>
                        {connecting === `${platform.id}-${product}` ? (
                          <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Clicking connect will redirect to {platform.name}&apos;s OAuth authorization page.
                    If env vars are not set, you&apos;ll see a &quot;Platform not configured&quot; error.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button onClick={onNext} variant="outline" className="flex-1">
          Continue to Blocked Platforms <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Blocked Platforms ────────────────────────────────────────────────

function StepBlockedPlatforms({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Lock className="w-5 h-5 text-red-400" />
          Waiting on Platform Approvals
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          These platforms are blocked pending external review. Nothing to do here except monitor.
        </p>
      </div>

      <div className="space-y-3">
        {BLOCKED_PLATFORMS.map((p) => (
          <div key={p.name} className="border border-red-100 rounded-lg p-4 bg-red-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="text-sm text-gray-600 mt-1">{p.reason}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ETA: {p.eta}
                </div>
              </div>
              <a
                href={p.checkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 flex-shrink-0 ml-4"
              >
                Check status <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Meta activation gate for PocketPals:</strong> Instagram and Facebook posting is blocked for PocketPals specifically until Meta Business Verification clears. When it does — connect via OAuth then activate in DB.
          </div>
        </div>
      </div>

      <Button onClick={onNext} className="w-full">
        Finish Setup <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  )
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone() {
  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900">Setup Complete</h2>
        <p className="text-sm text-gray-500 mt-2">
          Auto-connected platforms are active. OAuth platforms will be active once you finish registering dev apps.
          Blocked platforms will activate automatically once approvals clear.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4 text-sm text-left space-y-2">
        <div className="font-medium text-gray-700">What happens next:</div>
        <div className="space-y-1.5 text-gray-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            Bluesky + Mastodon: posting agent picks up active accounts at next 6hr cron run
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
            OAuth platforms: register dev apps → connect → accounts activate instantly
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            Meta + TikTok: check portals weekly — connect once approvals come through
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/social" className="flex-1">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Social Command Center
          </Button>
        </Link>
        <Link href="/dashboard" className="flex-1">
          <Button className="w-full">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function SetupWizard() {
  const [step, setStep] = useState(0)

  const next = () => setStep((s) => s + 1)

  return (
    <div>
      <StepIndicator current={step} />
      {step === 0 && <StepOverview onNext={next} />}
      {step === 1 && <StepAutoSetup onNext={next} />}
      {step === 2 && <StepOAuthSetup onNext={next} />}
      {step === 3 && <StepBlockedPlatforms onNext={next} />}
      {step === 4 && <StepDone />}
    </div>
  )
}
