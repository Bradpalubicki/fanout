'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { BarChart3, TrendingUp, CheckCircle2, XCircle, Download } from 'lucide-react'
import { PLATFORM_LABELS, type Platform } from '@/lib/types'

interface AnalyticsData {
  totalPosts: number
  successRate: number
  activePlatforms: number
  totalProfiles: number
  platformBreakdown: { platform: string; label: string; success: number; failed: number }[]
  topPosts: {
    id: string
    content: string
    platforms: string[]
    createdAt: string
    results: { platform: string; status: string }[]
  }[]
  timeHeatmap: { day: string; hour: number; count: number }[]
  recentPosts: {
    id: string
    content: string
    platforms: string[]
    createdAt: string
    profileName: string
    successCount: number
    failedCount: number
  }[]
}

const DATE_RANGES = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function heatmapColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'bg-gray-100'
  const pct = count / max
  if (pct > 0.75) return 'bg-blue-600'
  if (pct > 0.5) return 'bg-blue-400'
  if (pct > 0.25) return 'bg-blue-200'
  return 'bg-blue-100'
}

export default function AnalyticsV2Page() {
  const [dateRange, setDateRange] = useState('30')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/analytics?days=${dateRange}`)
      const json = await res.json() as AnalyticsData
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  async function exportCsv() {
    if (!data) return
    const rows = [
      ['Platform', 'Success', 'Failed'],
      ...data.platformBreakdown.map((p) => [p.label, p.success, p.failed]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fanout-analytics-${dateRange}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxHeatmap = data
    ? Math.max(...data.timeHeatmap.map((h) => h.count), 1)
    : 1

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Post performance across all profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportCsv} disabled={!data}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : !data ? (
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No analytics data available</p>
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total posts', value: data.totalPosts, icon: TrendingUp },
              { label: 'Success rate', value: data.totalPosts ? `${data.successRate}%` : '—', icon: CheckCircle2 },
              { label: 'Platforms active', value: data.activePlatforms, icon: BarChart3 },
              { label: 'Profiles', value: data.totalProfiles, icon: BarChart3 },
            ].map((s) => (
              <Card key={s.label} className="p-5 border-gray-100">
                <div className="text-3xl font-black text-black mb-1">{s.value}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Platform breakdown chart */}
          <Card className="p-5 border-gray-100 mb-6">
            <h2 className="font-semibold text-black mb-4">Posts per platform</h2>
            {data.platformBreakdown.every((p) => p.success === 0 && p.failed === 0) ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No posts in this range</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.platformBreakdown} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="success" name="Success" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Best time to post heatmap */}
          <Card className="p-5 border-gray-100 mb-6 overflow-x-auto">
            <h2 className="font-semibold text-black mb-4">Best time to post</h2>
            <div className="min-w-[600px]">
              <div className="flex gap-1">
                <div className="w-8" />
                {HOURS.filter((h) => h % 3 === 0).map((h) => (
                  <div key={h} className="flex-1 text-[10px] text-gray-400 text-center">
                    {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                  </div>
                ))}
              </div>
              {DAYS.map((day, dayIdx) => (
                <div key={day} className="flex gap-1 mt-1">
                  <div className="w-8 text-[10px] text-gray-400 flex items-center">{day}</div>
                  {HOURS.map((hour) => {
                    const cell = data.timeHeatmap.find((h) => h.day === day && h.hour === hour)
                    const count = cell?.count ?? 0
                    return (
                      <div
                        key={hour}
                        title={`${day} ${hour}:00 — ${count} posts`}
                        className={`flex-1 h-5 rounded-sm ${heatmapColor(count, maxHeatmap)}`}
                      />
                    )
                  })}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <span>Less</span>
                {['bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600'].map((c) => (
                  <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
                ))}
                <span>More</span>
              </div>
            </div>
          </Card>

          {/* Top posts */}
          {data.topPosts.length > 0 && (
            <Card className="border-gray-100 overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-black">Top posts</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {data.topPosts.map((post, idx) => (
                  <div key={post.id} className="p-4 flex items-center gap-4">
                    <div className="text-xs text-gray-300 font-bold w-5 text-center">#{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{post.content}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {post.platforms.slice(0, 4).map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs py-0 h-4">
                            {PLATFORM_LABELS[p as Platform]?.split(' ')[0] ?? p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" /> {post.results.filter((r) => r.status === 'success').length}
                      </span>
                      {post.results.filter((r) => r.status === 'failed').length > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="w-3 h-3" /> {post.results.filter((r) => r.status === 'failed').length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent posts table */}
          <Card className="border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-black">Recent posts</h2>
            </div>
            {data.recentPosts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No posts in this date range</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.recentPosts.map((post) => (
                  <div key={post.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 font-medium">{post.profileName}</span>
                        <div className="flex gap-1">
                          {post.platforms.slice(0, 3).map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs py-0 h-4">
                              {PLATFORM_LABELS[p as Platform]?.split(' ')[0] ?? p}
                            </Badge>
                          ))}
                          {post.platforms.length > 3 && (
                            <Badge variant="secondary" className="text-xs py-0 h-4">+{post.platforms.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 truncate max-w-sm">{post.content}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" /> {post.successCount}
                        </span>
                        {post.failedCount > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-3 h-3" /> {post.failedCount}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
