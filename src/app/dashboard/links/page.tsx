'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, Copy, Trash2, ExternalLink, Loader2, Link as LinkIcon, Rss } from 'lucide-react'

interface ShortLink {
  id: string
  code: string
  target_url: string
  title: string
  clicks_total: number
  created_at: string
}

const BASE_URL = 'https://fanout.digital/go'

export default function LinksPage() {
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [targetUrl, setTargetUrl] = useState('')
  const [title, setTitle] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/links')
      .then((r) => r.json())
      .then((d: { links: ShortLink[] }) => setLinks(d.links ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function createLink() {
    if (!targetUrl.trim()) { toast.error('Enter a URL'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/dashboard/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, title: title || targetUrl, customCode: customCode || undefined }),
      })
      const data = await res.json() as { link?: ShortLink; error?: string }
      if (!res.ok) { toast.error(data.error ?? 'Failed to create'); return }
      setLinks((prev) => [data.link!, ...prev])
      setTargetUrl('')
      setTitle('')
      setCustomCode('')
      toast.success('Short link created!')
    } finally {
      setCreating(false)
    }
  }

  async function deleteLink(id: string) {
    await fetch(`/api/dashboard/links?id=${id}`, { method: 'DELETE' })
    setLinks((prev) => prev.filter((l) => l.id !== id))
    toast.success('Deleted')
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${BASE_URL}/${code}`)
    toast.success('Copied!')
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Rss className="w-5 h-5 text-gray-600" />
          <h1 className="text-2xl font-bold text-black">Link Shortener</h1>
        </div>
        <p className="text-gray-500 text-sm mt-0.5">fanout.digital/go/[code] · Track clicks on every link</p>
      </div>

      {/* Create form */}
      <Card className="p-5 border-gray-100 mb-6">
        <h2 className="font-semibold text-black mb-4">Create a short link</h2>
        <div className="space-y-3">
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://your-long-url.com/some/very/long/path"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Link title (optional)"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <span className="px-3 py-2 bg-gray-50 text-xs text-gray-400 border-r border-gray-200 whitespace-nowrap">/go/</span>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                placeholder="custom-code (optional)"
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <Button
            className="bg-black text-white hover:bg-gray-800"
            onClick={createLink}
            disabled={creating || !targetUrl.trim()}
          >
            {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4 mr-2" /> Create link</>}
          </Button>
        </div>
      </Card>

      {/* Links list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : links.length === 0 ? (
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <LinkIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No links yet — create your first short link above</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <Card key={link.id} className="p-4 border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-black">{`${BASE_URL}/${link.code}`}</span>
                    <button onClick={() => copyLink(link.code)} className="text-gray-400 hover:text-black">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a href={`${BASE_URL}/${link.code}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{link.target_url}</p>
                </div>
                <div className="text-center shrink-0">
                  <div className="text-xl font-bold text-black">{link.clicks_total ?? 0}</div>
                  <div className="text-[10px] text-gray-400">clicks</div>
                </div>
                <div className="text-xs text-gray-400 shrink-0">
                  {new Date(link.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <button onClick={() => deleteLink(link.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
