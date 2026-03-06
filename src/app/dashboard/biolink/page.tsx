'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, X, ExternalLink, GripVertical, Link2, Loader2, QrCode } from 'lucide-react'

interface BiolinkPage {
  id: string
  handle: string
  title: string
  bio: string | null
  avatar_url: string | null
  background_color: string | null
  button_style: 'rounded' | 'pill' | 'square' | null
  links: Array<{ title: string; url: string }>
  is_published: boolean
  profile_id: string
}

interface Profile {
  id: string
  name: string
}

const BG_COLORS = ['#ffffff', '#f9fafb', '#0f172a', '#1e1b4b', '#14532d', '#7c2d12', '#f0fdf4', '#fef3c7']
const BUTTON_STYLES = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
  { value: 'square', label: 'Square' },
]

export default function BiolinkPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [pages, setPages] = useState<BiolinkPage[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [activePage, setActivePage] = useState<BiolinkPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [handle, setHandle] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [buttonStyle, setButtonStyle] = useState<'rounded' | 'pill' | 'square'>('rounded')
  const [links, setLinks] = useState<Array<{ title: string; url: string }>>([])
  const [isPublished, setIsPublished] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/profiles').then((r) => r.json()),
      fetch('/api/dashboard/biolink').then((r) => r.json()),
    ]).then(([pData, bData]: [{ profiles: Profile[] }, { pages: BiolinkPage[] }]) => {
      setProfiles(pData.profiles ?? [])
      setPages(bData.pages ?? [])
      if (bData.pages?.length) loadPage(bData.pages[0])
      if (pData.profiles?.length) setSelectedProfile(pData.profiles[0].id)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadPage(page: BiolinkPage) {
    setActivePage(page)
    setHandle(page.handle)
    setTitle(page.title)
    setBio(page.bio ?? '')
    setBgColor(page.background_color ?? '#ffffff')
    setButtonStyle(page.button_style ?? 'rounded')
    setLinks(page.links ?? [])
    setIsPublished(page.is_published)
  }

  function addLink() {
    setLinks((prev) => [...prev, { title: '', url: '' }])
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateLink(i: number, field: 'title' | 'url', value: string) {
    setLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }

    setSaving(true)
    try {
      if (activePage) {
        // Update
        const res = await fetch('/api/dashboard/biolink', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activePage.id,
            title, bio, background_color: bgColor, button_style: buttonStyle,
            links, is_published: isPublished,
          }),
        })
        const data = await res.json() as { page?: BiolinkPage; error?: string }
        if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
        setActivePage(data.page!)
        setPages((prev) => prev.map((p) => p.id === data.page!.id ? data.page! : p))
        toast.success('Saved!')
      } else {
        // Create
        if (!handle.trim()) { toast.error('Handle is required'); return }
        setCreating(true)
        const res = await fetch('/api/dashboard/biolink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handle: handle.toLowerCase(), title, bio,
            background_color: bgColor, button_style: buttonStyle,
            links, is_published: isPublished, profile_id: selectedProfile,
          }),
        })
        const data = await res.json() as { page?: BiolinkPage; error?: string }
        if (!res.ok) { toast.error(typeof data.error === 'string' ? data.error : 'Failed to create'); return }
        setPages((prev) => [data.page!, ...prev])
        loadPage(data.page!)
        toast.success('Link in Bio created!')
      }
    } finally {
      setSaving(false)
      setCreating(false)
    }
  }

  async function downloadQr() {
    if (!activePage) return
    const url = `https://fanout.digital/${activePage.handle}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `qr-${activePage.handle}.png`
    a.target = '_blank'
    a.click()
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="h-8 w-40 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Link in Bio</h1>
          <p className="text-gray-500 text-sm mt-0.5">fanout.digital/[handle] — your personal link hub</p>
        </div>
        <div className="flex gap-2">
          {activePage && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={downloadQr}>
                <QrCode className="w-3.5 h-3.5" /> QR Code
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                <a href={`/${activePage.handle}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
              </Button>
            </>
          )}
          {pages.length === 0 && (
            <Button size="sm" className="h-8 text-xs bg-black text-white" onClick={() => setActivePage(null)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Create page
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Editor */}
        <div className="lg:col-span-3 space-y-5">
          {/* Page selector */}
          {pages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPage(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    activePage?.id === p.id ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  /{p.handle}
                  {p.is_published && <span className="ml-1.5 text-[9px] bg-green-100 text-green-600 px-1 rounded">Live</span>}
                </button>
              ))}
              <button
                onClick={() => { setActivePage(null); setHandle(''); setTitle(''); setBio(''); setLinks([]); setIsPublished(false) }}
                className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-gray-300 text-gray-500 hover:border-gray-400"
              >
                <Plus className="w-3 h-3 inline mr-1" /> New
              </button>
            </div>
          )}

          <Card className="p-5 border-gray-100 space-y-4">
            {!activePage && (
              <>
                <div>
                  <label className="text-sm font-medium text-black mb-1.5 block">Handle</label>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <span className="px-3 py-2 bg-gray-50 text-xs text-gray-400 border-r border-gray-200">fanout.digital/</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                      placeholder="yourname"
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-black mb-1.5 block">Profile</label>
                  <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium text-black mb-1.5 block">Display name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-black mb-1.5 block">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
              <div className="text-right text-xs text-gray-400">{bio.length}/300</div>
            </div>

            {/* Style options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-black mb-2 block">Background</label>
                <div className="flex gap-2 flex-wrap">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${bgColor === c ? 'border-black scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-2 block">Button style</label>
                <div className="flex gap-2">
                  {BUTTON_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setButtonStyle(s.value as 'rounded' | 'pill' | 'square')}
                      className={`px-2 py-1 text-xs border transition-all ${
                        buttonStyle === s.value ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'
                      } ${s.value === 'pill' ? 'rounded-full' : s.value === 'rounded' ? 'rounded-lg' : ''}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Links */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-black">Links</label>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLink}>
                  <Plus className="w-3 h-3" /> Add link
                </Button>
              </div>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => updateLink(i, 'title', e.target.value)}
                      placeholder="Link title"
                      className="w-32 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateLink(i, 'url', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                    <button onClick={() => removeLink(i)} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Published toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <span className="text-sm font-medium text-black">Published</span>
                <p className="text-xs text-gray-400">Make this page live at fanout.digital/{handle || activePage?.handle}</p>
              </div>
              <button
                onClick={() => setIsPublished(!isPublished)}
                className={`w-10 h-6 rounded-full transition-colors relative ${isPublished ? 'bg-black' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isPublished ? 'left-5' : 'left-1'}`} />
              </button>
            </div>

            <Button
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={save}
              disabled={saving || creating}
            >
              {saving || creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : 'Save changes'}
            </Button>
          </Card>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <p className="text-xs font-medium text-gray-500 mb-3">Preview</p>
          <div
            className="rounded-2xl border border-gray-200 overflow-hidden"
            style={{ backgroundColor: bgColor }}
          >
            <div className="p-6">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3" />
              <h2 className="text-base font-bold text-center text-gray-900 mb-1">{title || 'Your Name'}</h2>
              {bio && <p className="text-xs text-gray-500 text-center mb-4">{bio}</p>}
              <div className="space-y-2">
                {links.filter((l) => l.title || l.url).map((link, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-2.5 bg-black text-white text-xs font-medium ${
                      buttonStyle === 'pill' ? 'rounded-full' : buttonStyle === 'square' ? '' : 'rounded-lg'
                    }`}
                  >
                    <span>{link.title || 'Link title'}</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </div>
                ))}
                {links.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-4">Add links above</div>
                )}
              </div>
              <div className="text-center mt-4">
                <span className="text-[10px] text-gray-400">fanout.digital/{handle || activePage?.handle || 'yourname'}</span>
              </div>
            </div>
          </div>
          {activePage && isPublished && (
            <div className="mt-3">
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs w-full justify-center py-1.5">
                <Link2 className="w-3 h-3 mr-1" /> Live at fanout.digital/{activePage.handle}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
