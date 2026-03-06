'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, MousePointerClick, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface ClickStat {
  date: string
  clicks: number
}

interface LinkStat {
  index: number
  title: string
  clicks: number
}

interface AnalyticsData {
  totalClicks: number
  last7d: number
  last30d: number
  dailyClicks: ClickStat[]
  linkBreakdown: LinkStat[]
  handle: string
}

export default function BiolinkAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/biolink/analytics')
      .then((r) => r.json())
      .then((d: AnalyticsData) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 max-w-4xl">
        <Link href="/dashboard/biolink" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Link in Bio
        </Link>
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <MousePointerClick className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No analytics yet — publish your Link in Bio page to start tracking</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/dashboard/biolink" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Link in Bio
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Link in Bio Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">fanout.digital/{data.handle}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total clicks', value: data.totalClicks },
          { label: 'Last 7 days', value: data.last7d },
          { label: 'Last 30 days', value: data.last30d },
        ].map((s) => (
          <Card key={s.label} className="p-5 border-gray-100">
            <div className="text-3xl font-black text-black mb-1">{s.value}</div>
            <div className="text-gray-500 text-sm">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Daily clicks chart */}
      <Card className="p-5 border-gray-100 mb-6">
        <h2 className="font-semibold text-black mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" /> Clicks per day (last 30 days)
        </h2>
        {data.dailyClicks.every((d) => d.clicks === 0) ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No click data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.dailyClicks} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: unknown) => {
                const d = new Date(v as string)
                return `${d.getMonth() + 1}/${d.getDate()}`
              }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                labelFormatter={(v: unknown) => new Date(v as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <Bar dataKey="clicks" name="Clicks" fill="#111827" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Per-link breakdown */}
      {data.linkBreakdown.length > 0 && (
        <Card className="border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-black flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-gray-400" /> Clicks by link
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.linkBreakdown.map((link) => {
              const maxClicks = Math.max(...data.linkBreakdown.map((l) => l.clicks), 1)
              const pct = Math.round((link.clicks / maxClicks) * 100)
              return (
                <div key={link.index} className="p-4 flex items-center gap-4">
                  <div className="text-xs text-gray-300 font-bold w-5 text-center">#{link.index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">{link.title || `Link ${link.index + 1}`}</p>
                    <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-black shrink-0 w-10 text-right">{link.clicks}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
