'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Plus, X, Calendar, List } from 'lucide-react'
import { PLATFORM_LABELS, type Platform, SUPPORTED_PLATFORMS } from '@/lib/types'

interface Post {
  id: string
  content: string
  platforms: string[]
  scheduled_for: string | null
  status: string
  profile_id: string
}

interface Profile {
  id: string
  name: string
  slug: string
}

const PLATFORM_BG: Record<string, string> = {
  twitter: 'bg-black',
  linkedin: 'bg-blue-700',
  facebook: 'bg-blue-500',
  instagram: 'bg-pink-500',
  tiktok: 'bg-gray-900',
  pinterest: 'bg-red-600',
  youtube: 'bg-red-500',
  reddit: 'bg-orange-500',
  threads: 'bg-gray-800',
  google_business_profile: 'bg-blue-400',
  bluesky: 'bg-sky-500',
  mastodon: 'bg-purple-600',
}

export default function CalendarPage() {
  const router = useRouter()
  const [view, setView] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState<Post | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [pRes, prRes] = await Promise.all([
      fetch('/api/dashboard/profiles'),
      fetch('/api/dashboard/calendar-posts'),
    ])
    const pData = await pRes.json() as { profiles: Profile[] }
    const prData = await prRes.json() as { posts: Post[] }
    setProfiles(pData.profiles ?? [])
    setPosts(prData.posts ?? [])
    setLoading(false)
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void fetchData()
  }, [fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calendar grid helpers
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells: { date: Date | null; isCurrentMonth: boolean }[] = []
  for (let i = 0; i < firstDay; i++) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - firstDay + i + 1), isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, cells.length - daysInMonth - firstDay + 1), isCurrentMonth: false })
  }

  // Week view: 7 days from start of week containing currentDate
  const weekStart = new Date(currentDate)
  weekStart.setDate(currentDate.getDate() - currentDate.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  function postsForDay(date: Date) {
    return posts.filter(p => {
      if (!p.scheduled_for) return false
      const pd = new Date(p.scheduled_for)
      if (pd.toDateString() !== date.toDateString()) return false
      if (selectedProfile !== 'all' && p.profile_id !== selectedProfile) return false
      if (selectedPlatform !== 'all' && !p.platforms.includes(selectedPlatform)) return false
      return true
    })
  }

  function handleDayClick(date: Date) {
    const iso = date.toISOString().slice(0, 16)
    router.push(`/dashboard/compose?scheduledFor=${iso}`)
  }

  async function handleDrop(date: Date, post: Post) {
    const newDate = new Date(date)
    if (post.scheduled_for) {
      const orig = new Date(post.scheduled_for)
      newDate.setHours(orig.getHours(), orig.getMinutes())
    } else {
      newDate.setHours(9, 0)
    }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, scheduled_for: newDate.toISOString() } : p))
    await fetch(`/api/dashboard/post/${post.id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_for: newDate.toISOString() }),
    })
    setDragging(null)
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date(currentDate)
            if (view === 'month') { d.setMonth(d.getMonth() - 1) } else { d.setDate(d.getDate() - 7) }
            setCurrentDate(d)
          }}><ChevronLeft className="w-4 h-4" /></Button>
          <h2 className="text-lg font-bold text-black min-w-[180px] text-center">{monthName}</h2>
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date(currentDate)
            if (view === 'month') { d.setMonth(d.getMonth() + 1) } else { d.setDate(d.getDate() + 7) }
            setCurrentDate(d)
          }}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All profiles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All profiles</SelectItem>
              {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All platforms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {SUPPORTED_PLATFORMS.map(p => <SelectItem key={p} value={p}>{PLATFORM_LABELS[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView('month')} className={`px-3 py-1.5 text-xs flex items-center gap-1 ${view === 'month' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Calendar className="w-3.5 h-3.5" /> Month
            </button>
            <button onClick={() => setView('week')} className={`px-3 py-1.5 text-xs flex items-center gap-1 ${view === 'week' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <List className="w-3.5 h-3.5" /> Week
            </button>
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={() => router.push('/dashboard/compose')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Post
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading calendar…</div>
      ) : view === 'month' ? (
        /* Month View */
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              if (!cell.date) return <div key={i} className="h-28 border-b border-r border-gray-50" />
              const dayPosts = postsForDay(cell.date)
              const isToday = cell.date.toDateString() === new Date().toDateString()
              return (
                <div
                  key={i}
                  className={`h-28 border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-blue-50/30 transition-colors relative group ${!cell.isCurrentMonth ? 'bg-gray-50/50' : ''}`}
                  onClick={() => handleDayClick(cell.date!)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (dragging) handleDrop(cell.date!, dragging) }}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black text-white' : cell.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayPosts.slice(0, 3).map(post => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={e => { e.stopPropagation(); setDragging(post) }}
                        onDragEnd={() => setDragging(null)}
                        onClick={e => { e.stopPropagation(); setSelectedPost(post) }}
                        className={`text-xs px-1.5 py-0.5 rounded truncate text-white cursor-grab active:cursor-grabbing ${PLATFORM_BG[post.platforms[0]] ?? 'bg-gray-500'}`}
                        title={post.content}
                      >
                        {post.content.slice(0, 28)}…
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-xs text-gray-400 px-1">+{dayPosts.length - 3} more</div>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100">
                    <Plus className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Week View */
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            {weekDays.map(d => {
              const isToday = d.toDateString() === new Date().toDateString()
              return (
                <div key={d.toISOString()} className="text-center py-3">
                  <div className="text-xs text-gray-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className={`text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'bg-black text-white' : 'text-gray-800'}`}>
                    {d.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map(d => {
              const dayPosts = postsForDay(d)
              return (
                <div
                  key={d.toISOString()}
                  className="border-r border-gray-50 p-2 min-h-[400px] cursor-pointer hover:bg-blue-50/20"
                  onClick={() => handleDayClick(d)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (dragging) handleDrop(d, dragging) }}
                >
                  <div className="space-y-1">
                    {dayPosts.map(post => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={e => { e.stopPropagation(); setDragging(post) }}
                        onDragEnd={() => setDragging(null)}
                        onClick={e => { e.stopPropagation(); setSelectedPost(post) }}
                        className={`text-xs p-2 rounded-lg text-white cursor-grab active:cursor-grabbing ${PLATFORM_BG[post.platforms[0]] ?? 'bg-gray-500'}`}
                      >
                        <div className="font-medium truncate">{post.content.slice(0, 40)}</div>
                        <div className="opacity-70 mt-0.5">{post.scheduled_for ? new Date(post.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</div>
                        <div className="flex gap-0.5 mt-1 flex-wrap">
                          {post.platforms.slice(0, 3).map(p => (
                            <span key={p} className="text-[9px] bg-white/20 px-1 rounded">{PLATFORM_LABELS[p as Platform] ?? p}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-black">Post Detail</h3>
              <button onClick={() => setSelectedPost(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-700 mb-3">{selectedPost.content}</p>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {selectedPost.platforms.map(p => (
                <Badge key={p} className={`text-white text-xs ${PLATFORM_BG[p] ?? 'bg-gray-500'}`}>{PLATFORM_LABELS[p as Platform] ?? p}</Badge>
              ))}
            </div>
            {selectedPost.scheduled_for && (
              <p className="text-xs text-gray-500 mb-4">Scheduled: {new Date(selectedPost.scheduled_for).toLocaleString()}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { router.push(`/dashboard/compose?postId=${selectedPost.id}`); setSelectedPost(null) }}>Edit</Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={async () => {
                await fetch(`/api/dashboard/post/${selectedPost.id}/cancel`, { method: 'POST' })
                setSelectedPost(null)
                fetchData()
              }}>Cancel Post</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
