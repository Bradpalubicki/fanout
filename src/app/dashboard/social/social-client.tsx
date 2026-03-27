'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { RefreshCw, Sparkles, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import type { IntegrationCheck } from '@/lib/integration-status'
import { PRODUCT_CONFIGS, PLATFORM_RULES, type Product } from '@/lib/product-platforms'

interface QueueRow {
  id: string
  product: string
  platform: string
  content: string
  status: string
  error_text: string | null
  posted_at: string | null
  scheduled_for: string | null
  platform_post_url: string | null
  created_at: string
}

interface StatusData {
  integrations: IntegrationCheck[]
  queue: {
    pending: number
    posted: number
    failed: number
    byProduct: Record<string, number>
    byPlatform: Record<string, number>
  }
  connectedAccounts: Array<{
    product: string
    platform: string
    account_handle: string | null
    status: string
    last_used_at: string | null
  }>
}

const STATUS_COLORS: Record<string, string> = {
  WORKING: 'bg-green-100 text-green-800',
  BROKEN: 'bg-red-100 text-red-800',
  NEVER_SETUP: 'bg-gray-100 text-gray-600',
  TOKEN_EXPIRED: 'bg-yellow-100 text-yellow-800',
}

const POST_STATUS_ICON: Record<string, React.ReactNode> = {
  posted: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
  posting: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  skipped: <AlertTriangle className="w-4 h-4 text-gray-400" />,
}

export function SocialCommandCenter() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [filterProduct, setFilterProduct] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [genProduct, setGenProduct] = useState<Product>('certusaudit')
  const [genPlatform, setGenPlatform] = useState('twitter')
  const [genTopic, setGenTopic] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/social-status')
      if (res.ok) {
        setStatus(await res.json() as StatusData)
      }
    } catch {
      // silent
    }
  }, [])

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterProduct !== 'all') params.set('product', filterProduct)
      if (filterPlatform !== 'all') params.set('platform', filterPlatform)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`/api/social-queue?${params}`)
      if (res.ok) {
        const data = await res.json() as { posts: QueueRow[] }
        setQueue(data.posts ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterProduct, filterPlatform, filterStatus])

  useEffect(() => {
    fetchStatus()
    fetchQueue()
  }, [fetchStatus, fetchQueue])

  async function generateContent() {
    if (!genProduct || !genPlatform) return
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-social-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_INTERNAL_KEY ?? ''}`,
        },
        body: JSON.stringify({
          product: genProduct,
          platform: genPlatform,
          topic: genTopic || undefined,
          queue: true,
        }),
      })
      const data = await res.json() as { content?: string; queued?: boolean; error?: string }
      if (res.ok && data.queued) {
        toast.success('Content generated and queued!')
        fetchQueue()
        setGenTopic('')
      } else {
        toast.error(data.error ?? 'Generation failed')
      }
    } catch (e) {
      toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  const workingPlatforms = status?.integrations.filter((i) => i.status === 'WORKING') ?? []
  const brokenPlatforms = status?.integrations.filter((i) => i.status !== 'WORKING') ?? []
  const availablePlatforms = PRODUCT_CONFIGS[genProduct]?.platforms ?? []

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {status && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{status.queue.pending}</div>
            <div className="text-xs text-gray-500 mt-1">Pending</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{status.queue.posted}</div>
            <div className="text-xs text-gray-500 mt-1">Posted</div>
          </div>
          <div className="bg-white border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{status.queue.failed}</div>
            <div className="text-xs text-gray-500 mt-1">Failed</div>
          </div>
        </div>
      )}

      {/* Integration status */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Integration Status (13 platforms)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Platform</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Root Cause</th>
                <th className="pb-2 font-medium">Fix Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {status?.integrations.map((item) => (
                <tr key={item.platform}>
                  <td className="py-2 font-medium capitalize">{item.platform.replace('_', ' ')}</td>
                  <td className="py-2">
                    <Badge className={STATUS_COLORS[item.status] ?? 'bg-gray-100'}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-gray-600 max-w-xs truncate" title={item.rootCause}>
                    {item.rootCause}
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{item.fixTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {workingPlatforms.length > 0 && (
          <p className="text-xs text-green-600 mt-3">
            ✓ Working: {workingPlatforms.map((p) => p.platform).join(', ')}
          </p>
        )}
        {brokenPlatforms.length > 0 && (
          <p className="text-xs text-red-500 mt-1">
            ✗ Broken: {brokenPlatforms.map((p) => p.platform).join(', ')}
          </p>
        )}
      </div>

      {/* Generate + queue content */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Generate &amp; Queue Content
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Select value={genProduct} onValueChange={(v) => setGenProduct(v as Product)}>
            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_CONFIGS).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={genPlatform} onValueChange={setGenPlatform}>
            <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              {availablePlatforms.map((p) => (
                <SelectItem key={p} value={p} disabled={!PLATFORM_RULES[p]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            className="col-span-2 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Topic (optional) — leave blank for AI choice"
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
          />
        </div>
        <Button onClick={generateContent} disabled={generating} className="w-full md:w-auto">
          {generating ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Generate &amp; Queue</>
          )}
        </Button>
        <p className="text-xs text-gray-400 mt-2">
          Uses Claude Haiku. Content is queued immediately and will post at next 6-hour agent run.
        </p>
      </div>

      {/* Queue table */}
      <div className="bg-white border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Posts Queue</h2>
          <div className="flex gap-2">
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {Object.entries(PRODUCT_CONFIGS).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {['twitter', 'linkedin', 'instagram', 'tiktok', 'bluesky', 'mastodon', 'reddit'].map((p) => (
                  <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchQueue} className="h-8">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 text-sm py-8 text-center">Loading queue...</div>
        ) : queue.length === 0 ? (
          <div className="text-gray-400 text-sm py-8 text-center">
            No posts in queue. Generate some content above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium w-8"></th>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Platform</th>
                  <th className="pb-2 font-medium">Content</th>
                  <th className="pb-2 font-medium">Scheduled</th>
                  <th className="pb-2 font-medium">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {queue.map((row) => (
                  <tr key={row.id} className={row.status === 'failed' ? 'bg-red-50' : ''}>
                    <td className="py-2">{POST_STATUS_ICON[row.status] ?? null}</td>
                    <td className="py-2 font-medium capitalize">{row.product}</td>
                    <td className="py-2 capitalize">{row.platform}</td>
                    <td className="py-2 max-w-xs">
                      <p className="truncate text-gray-700" title={row.content}>{row.content}</p>
                      {row.error_text && (
                        <p className="text-xs text-red-500 mt-0.5 truncate" title={row.error_text}>
                          {row.error_text}
                        </p>
                      )}
                    </td>
                    <td className="py-2 text-gray-400 text-xs">
                      {row.scheduled_for
                        ? new Date(row.scheduled_for).toLocaleString()
                        : 'Next run'}
                    </td>
                    <td className="py-2 text-gray-400 text-xs">
                      {row.platform_post_url ? (
                        <a
                          href={row.platform_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View
                        </a>
                      ) : row.posted_at ? (
                        new Date(row.posted_at).toLocaleString()
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connected accounts */}
      {status?.connectedAccounts && status.connectedAccounts.length > 0 && (
        <div className="bg-white border rounded-lg p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Connected Product Accounts</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {status.connectedAccounts.map((acc) => (
              <div key={`${acc.product}-${acc.platform}`} className="border rounded-md p-3 text-sm">
                <div className="font-medium capitalize">{acc.product}</div>
                <div className="text-gray-500 capitalize">{acc.platform}</div>
                {acc.account_handle && (
                  <div className="text-gray-400 text-xs">{acc.account_handle}</div>
                )}
                <Badge className={acc.status === 'active' ? 'bg-green-100 text-green-700 mt-1' : 'bg-red-100 text-red-700 mt-1'}>
                  {acc.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
