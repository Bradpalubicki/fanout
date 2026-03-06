'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { MessageSquare, Loader2, Sparkles, Send, RefreshCw } from 'lucide-react'
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS, type Platform } from '@/lib/types'

interface InboxItem {
  id: string
  profile_id: string
  platform: string
  type: 'comment' | 'dm' | 'mention'
  sender_name: string
  sender_avatar: string | null
  content: string
  post_url: string | null
  platform_item_id: string
  status: 'unread' | 'read' | 'replied'
  received_at: string
}

const TYPE_LABELS: Record<string, string> = {
  comment: 'Comment',
  dm: 'DM',
  mention: 'Mention',
}

const PLATFORM_DOT: Record<string, string> = {
  twitter: 'bg-black',
  linkedin: 'bg-blue-700',
  facebook: 'bg-blue-500',
  instagram: 'bg-pink-500',
  youtube: 'bg-red-500',
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)
  const [suggestingReply, setSuggestingReply] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/inbox?platform=${platformFilter}&status=${statusFilter}`)
      const data = await res.json() as { items: InboxItem[]; unreadCount: number }
      setItems(data.items ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } finally {
      setLoading(false)
    }
  }, [platformFilter, statusFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function markRead(item: InboxItem) {
    if (item.status !== 'unread') return
    await fetch('/api/dashboard/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status: 'read' }),
    })
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: 'read' } : i))
    setUnreadCount((n) => Math.max(0, n - 1))
  }

  async function selectItem(item: InboxItem) {
    setSelectedItem(item)
    setReply('')
    await markRead(item)
  }

  async function suggestReply() {
    if (!selectedItem) return
    setSuggestingReply(true)
    try {
      const res = await fetch('/api/dashboard/inbox/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          senderName: selectedItem.sender_name,
          content: selectedItem.content,
          platform: selectedItem.platform,
          type: selectedItem.type,
        }),
      })
      const data = await res.json() as { reply?: string }
      if (data.reply) setReply(data.reply)
    } catch {
      toast.error('Failed to generate reply')
    } finally {
      setSuggestingReply(false)
    }
  }

  async function sendReply() {
    if (!selectedItem || !reply.trim()) return
    setReplying(true)
    try {
      await fetch('/api/dashboard/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedItem.id, status: 'replied', reply }),
      })
      setItems((prev) => prev.map((i) => i.id === selectedItem.id ? { ...i, status: 'replied' } : i))
      setSelectedItem((prev) => prev ? { ...prev, status: 'replied' } : null)
      setReply('')
      toast.success('Reply sent!')
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setReplying(false)
    }
  }

  const filteredItems = items.filter((item) => {
    if (platformFilter !== 'all' && item.platform !== platformFilter) return false
    if (statusFilter === 'unread' && item.status !== 'unread') return false
    return true
  })

  return (
    <div className="p-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-black">Inbox</h1>
            {unreadCount > 0 && (
              <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Comments, DMs, and mentions across all platforms</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fetchItems}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex gap-4">
        {/* Sidebar filters + list */}
        <div className="w-72 shrink-0">
          {/* Filters */}
          <div className="space-y-2 mb-4">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {['all', 'unread'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`flex-1 py-1.5 capitalize ${statusFilter === f ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setPlatformFilter('all')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs ${platformFilter === 'all' ? 'bg-gray-100 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                All platforms
              </button>
              {(['twitter', 'instagram', 'facebook', 'linkedin', 'youtube'] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${platformFilter === p ? 'bg-gray-100 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${PLATFORM_DOT[p] ?? 'bg-gray-400'}`} />
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Item list */}
          <div className="space-y-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No messages found</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedItem?.id === item.id
                      ? 'border-black bg-gray-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${PLATFORM_DOT[item.platform] ?? 'bg-gray-400'}`} />
                    <span className="text-xs font-medium text-black truncate">{item.sender_name}</span>
                    {item.status === 'unread' && (
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full ml-auto shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{item.content}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px] py-0 h-4">{TYPE_LABELS[item.type] ?? item.type}</Badge>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(item.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {!selectedItem ? (
            <Card className="h-full min-h-[400px] border-dashed border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select a message to view</p>
              </div>
            </Card>
          ) : (
            <Card className="p-5 border-gray-100">
              {/* Message header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-black">{selectedItem.sender_name}</span>
                    <Badge variant="secondary" className="text-xs">{TYPE_LABELS[selectedItem.type]}</Badge>
                    <Badge variant="outline" className="text-xs">{PLATFORM_LABELS[selectedItem.platform as Platform] ?? selectedItem.platform}</Badge>
                    {selectedItem.status === 'replied' && (
                      <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Replied</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(selectedItem.received_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
                {selectedItem.post_url && (
                  <a
                    href={selectedItem.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline"
                  >
                    View post
                  </a>
                )}
              </div>

              {/* Message content */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedItem.content}</p>
              </div>

              {/* Reply area */}
              {selectedItem.status !== 'replied' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-black">Reply</label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                      onClick={suggestReply}
                      disabled={suggestingReply}
                    >
                      {suggestingReply
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                        : <><Sparkles className="w-3 h-3" /> Suggest reply</>
                      }
                    </Button>
                  </div>
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    className="min-h-24 text-sm"
                  />
                  <Button
                    className="bg-black text-white hover:bg-gray-800 gap-2"
                    onClick={sendReply}
                    disabled={replying || !reply.trim()}
                  >
                    {replying ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send reply</>}
                  </Button>
                </div>
              )}

              {selectedItem.status === 'replied' && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700">
                  This message has been replied to.
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
