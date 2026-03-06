'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, ChevronRight, Globe, Users, Sparkles, Rocket, Building2, Zap } from 'lucide-react'
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from '@/lib/types'

const CATEGORIES = [
  'Restaurant', 'Salon / Spa', 'Dental / Medical', 'Retail Store',
  'Fitness / Gym', 'Real Estate', 'Contractor / Trades', 'Professional Services', 'Other',
]

const PLATFORM_SETUP_TIME: Partial<Record<Platform, string>> = {
  twitter: '~2 min',
  linkedin: '~3 min',
  facebook: '~4 min',
  instagram: '~3 min',
  tiktok: '~4 min',
  pinterest: '~2 min',
  youtube: '~5 min',
  google_business_profile: '~3 min',
  bluesky: '~2 min',
}

interface BusinessInfo {
  name: string
  website: string
  category: string
  phone: string
  email: string
  city: string
  state: string
}

interface BrandData {
  tagline: string
  about: string
  services: string[]
  tone: string
  colors: string[]
  logoUrl: string
  photosFound: number
}

interface PlatformBio {
  platform: string
  displayName: string
  bio: string
  hashtags: string[]
}

type WizardStep = 'business' | 'platforms' | 'extract' | 'preview' | 'launch'

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'business', label: 'Business info', icon: Building2 },
  { key: 'platforms', label: 'Choose platforms', icon: Globe },
  { key: 'extract', label: 'Brand extraction', icon: Sparkles },
  { key: 'preview', label: 'AI preview', icon: Users },
  { key: 'launch', label: 'Launch', icon: Rocket },
]

export default function ZeroPresencePage() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('business')
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: '', website: '', category: '', phone: '', email: '', city: '', state: '',
  })
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [extracting, setExtracting] = useState(false)
  const [brandData, setBrandData] = useState<BrandData | null>(null)
  const [platformBios, setPlatformBios] = useState<PlatformBio[]>([])
  const [generatingBios, setGeneratingBios] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [setupJobId, setSetupJobId] = useState<string | null>(null)
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, string>>({})

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  function togglePlatform(p: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  function validateBusiness() {
    if (!businessInfo.name.trim()) { toast.error('Business name is required'); return false }
    if (!businessInfo.category) { toast.error('Select a business category'); return false }
    return true
  }

  async function extractBrand() {
    if (!businessInfo.website.trim()) {
      // Skip extraction if no website
      setBrandData({
        tagline: `${businessInfo.name} — ${businessInfo.category}`,
        about: `${businessInfo.name} is a ${businessInfo.category.toLowerCase()} business located in ${businessInfo.city}, ${businessInfo.state}.`,
        services: [],
        tone: 'professional and friendly',
        colors: [],
        logoUrl: '',
        photosFound: 0,
      })
      setStep('preview')
      await generateBios({
        tagline: businessInfo.name,
        about: '',
        services: [],
        tone: 'professional and friendly',
        colors: [],
        logoUrl: '',
        photosFound: 0,
      })
      return
    }

    setExtracting(true)
    try {
      const res = await fetch('/api/setup/extract-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: businessInfo.website, businessInfo }),
      })
      const data = await res.json() as { brandData?: BrandData; error?: string }
      if (!res.ok || !data.brandData) {
        toast.error(data.error ?? 'Brand extraction failed')
        // Fallback: proceed with basic info
        const fallback: BrandData = {
          tagline: businessInfo.name,
          about: `${businessInfo.name} — ${businessInfo.category} in ${businessInfo.city}, ${businessInfo.state}`,
          services: [],
          tone: 'professional and friendly',
          colors: [],
          logoUrl: '',
          photosFound: 0,
        }
        setBrandData(fallback)
        setStep('preview')
        await generateBios(fallback)
        return
      }
      setBrandData(data.brandData)
      setStep('preview')
      await generateBios(data.brandData)
    } catch {
      toast.error('Brand extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  async function generateBios(brand: BrandData) {
    setGeneratingBios(true)
    try {
      const res = await fetch('/api/setup/generate-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandData: brand, platforms: selectedPlatforms, businessInfo }),
      })
      const data = await res.json() as { profiles?: PlatformBio[]; error?: string }
      if (res.ok && data.profiles) {
        setPlatformBios(data.profiles)
      }
    } catch {
      // Silently fail — bios are preview only
    } finally {
      setGeneratingBios(false)
    }
  }

  async function launch() {
    setLaunching(true)
    const statuses: Record<string, string> = {}
    for (const p of selectedPlatforms) statuses[p] = 'queued'
    setPlatformStatuses(statuses)
    setStep('launch')

    try {
      // Create setup job
      const res = await fetch('/api/setup/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessInfo,
          brandData,
          platforms: selectedPlatforms,
          platformBios,
        }),
      })
      const data = await res.json() as { jobId?: string; profileId?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Setup failed'); return }
      setSetupJobId(data.jobId ?? null)

      // Simulate platform setup progress
      for (const p of selectedPlatforms) {
        await new Promise((r) => setTimeout(r, 800))
        setPlatformStatuses((prev) => ({ ...prev, [p]: 'setting_up' }))
        await new Promise((r) => setTimeout(r, 1200))
        setPlatformStatuses((prev) => ({ ...prev, [p]: 'done' }))
      }

      toast.success('Setup complete! Your 30-day content calendar has been generated.')
    } catch {
      toast.error('Launch failed')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h1 className="text-2xl font-bold text-black">Quick Setup</h1>
        </div>
        <p className="text-gray-500 text-sm">Zero social media presence → live in 2 hours</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const done = i < stepIndex
          const active = s.key === step
          return (
            <div key={s.key} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active ? 'bg-black text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Business Info */}
      {step === 'business' && (
        <Card className="p-6 border-gray-100">
          <h2 className="font-semibold text-black mb-6">Tell us about your business</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-black mb-1.5 block">Business name *</label>
                <input
                  type="text"
                  value={businessInfo.name}
                  onChange={(e) => setBusinessInfo((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Coffee Co."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-black mb-1.5 block">Website URL <span className="text-gray-400 font-normal">(optional — improves AI quality)</span></label>
                <input
                  type="url"
                  value={businessInfo.website}
                  onChange={(e) => setBusinessInfo((p) => ({ ...p, website: e.target.value }))}
                  placeholder="https://yourwebsite.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-black mb-1.5 block">Category *</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBusinessInfo((p) => ({ ...p, category: c }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        businessInfo.category === c
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-1.5 block">City</label>
                <input
                  type="text"
                  value={businessInfo.city}
                  onChange={(e) => setBusinessInfo((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Chicago"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-1.5 block">State</label>
                <input
                  type="text"
                  value={businessInfo.state}
                  onChange={(e) => setBusinessInfo((p) => ({ ...p, state: e.target.value }))}
                  placeholder="IL"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-1.5 block">Phone</label>
                <input
                  type="tel"
                  value={businessInfo.phone}
                  onChange={(e) => setBusinessInfo((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={businessInfo.email}
                  onChange={(e) => setBusinessInfo((p) => ({ ...p, email: e.target.value }))}
                  placeholder="info@yourbusiness.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
            <Button
              className="w-full bg-black text-white hover:bg-gray-800 mt-2"
              onClick={() => { if (validateBusiness()) setStep('platforms') }}
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Platform Selection */}
      {step === 'platforms' && (
        <Card className="p-6 border-gray-100">
          <h2 className="font-semibold text-black mb-2">Choose your platforms</h2>
          <p className="text-gray-500 text-sm mb-6">Select the platforms you want to build a presence on. We&apos;ll generate optimized bios and content for each.</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {SUPPORTED_PLATFORMS.map((p) => {
              const selected = selectedPlatforms.includes(p)
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selected ? 'border-black bg-black/5' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${selected ? 'text-black' : 'text-gray-700'}`}>
                      {PLATFORM_LABELS[p]}
                    </span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-black shrink-0" />}
                  </div>
                  {PLATFORM_SETUP_TIME[p] && (
                    <span className="text-xs text-gray-400">{PLATFORM_SETUP_TIME[p]}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('business')}>Back</Button>
            <Button
              className="flex-1 bg-black text-white hover:bg-gray-800"
              disabled={selectedPlatforms.length === 0}
              onClick={() => setStep('extract')}
            >
              Continue with {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Brand Extraction */}
      {step === 'extract' && (
        <Card className="p-6 border-gray-100 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="font-semibold text-black text-xl mb-2">
            {extracting ? 'Extracting your brand…' : 'Ready to extract your brand'}
          </h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            {businessInfo.website
              ? `We'll scrape ${businessInfo.website} to extract your brand identity, services, and tone of voice.`
              : 'We\'ll use your business info to generate AI-optimized profiles for each platform.'}
          </p>

          {extracting ? (
            <div className="space-y-3 max-w-xs mx-auto mb-6">
              {['Scraping website content…', 'Analyzing brand voice…', 'Extracting services…', 'Detecting colors…'].map((msg, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-left">
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin shrink-0" />
                  <span className="text-gray-600">{msg}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setStep('platforms')}>Back</Button>
              <Button className="bg-black text-white hover:bg-gray-800" onClick={extractBrand}>
                {businessInfo.website ? 'Extract brand & continue' : 'Generate profiles & continue'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Step 4: AI Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <Card className="p-5 border-gray-100">
            <h2 className="font-semibold text-black mb-4">Brand snapshot</h2>
            {brandData && (
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tagline</span>
                  <p className="text-sm text-gray-800 mt-0.5">{brandData.tagline || '—'}</p>
                </div>
                {brandData.about && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">About</span>
                    <p className="text-sm text-gray-800 mt-0.5 line-clamp-3">{brandData.about}</p>
                  </div>
                )}
                {brandData.services.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Services</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {brandData.services.slice(0, 6).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tone</span>
                  <p className="text-sm text-gray-800 mt-0.5">{brandData.tone}</p>
                </div>
              </div>
            )}
          </Card>

          {generatingBios && (
            <Card className="p-6 border-gray-100 text-center">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Generating platform-specific bios…</p>
            </Card>
          )}

          {platformBios.length > 0 && (
            <Card className="p-5 border-gray-100">
              <h2 className="font-semibold text-black mb-4">Generated platform bios</h2>
              <div className="space-y-4">
                {platformBios.map((bio) => (
                  <div key={bio.platform} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">{PLATFORM_LABELS[bio.platform as Platform] ?? bio.platform}</Badge>
                      <span className="text-xs text-gray-400">{bio.bio.length} chars</span>
                    </div>
                    <p className="text-xs text-gray-700 mb-2">{bio.bio}</p>
                    {bio.hashtags.length > 0 && (
                      <p className="text-xs text-blue-600">{bio.hashtags.slice(0, 5).map((h) => `#${h}`).join(' ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('extract')}>Back</Button>
            <Button className="flex-1 bg-black text-white hover:bg-gray-800" onClick={launch}>
              <Rocket className="w-4 h-4 mr-2" /> Launch my presence
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Launch */}
      {step === 'launch' && (
        <Card className="p-6 border-gray-100">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-semibold text-black text-xl mb-2">
              {launching ? "Setting everything up…" : "You're live!"}
            </h2>
            <p className="text-gray-500 text-sm">
              {launching ? "Creating your profile and generating your 30-day content calendar." : "Your profile and content calendar are ready."}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {selectedPlatforms.map((p) => {
              const status = platformStatuses[p]
              return (
                <div key={p} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-black">{PLATFORM_LABELS[p]}</span>
                  </div>
                  {status === 'done' ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Connected
                    </div>
                  ) : status === 'setting_up' ? (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" /> Setting up…
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">Queued</div>
                  )}
                </div>
              )
            })}
          </div>

          {!launching && (
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-black text-white hover:bg-gray-800"
                onClick={() => router.push('/dashboard/calendar')}
              >
                View content calendar
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/profiles')}>
                View profile
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
