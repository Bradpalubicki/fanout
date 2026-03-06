'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2, Clock, Edit3, Send } from 'lucide-react'
import { PLATFORM_LABELS, type Platform } from '@/lib/types'

interface PendingPost {
  id: string
  content: string
  platforms: string[]
  scheduled_for: string | null
  created_at: string
  source: string
  profiles: { name: string } | null
}

export default function ApprovalsPage() {
  const [posts, setPosts] = useState<PendingPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [actioning, setActioning] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/approvals')
      const data = await res.json() as { posts: PendingPost[] }
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function approve(id: string, content?: string) {
    setActioning(id)
    try {
      const res = await fetch('/api/dashboard/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve', content }),
      })
      if (!res.ok) { toast.error('Failed to approve'); return }
      setPosts((prev) => prev.filter((p) => p.id !== id))
      setEditingId(null)
      toast.success('Post approved — queued for distribution')
    } finally {
      setActioning(null)
    }
  }

  async function reject(id: string) {
    setActioning(id)
    try {
      const res = await fetch('/api/dashboard/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' }),
      })
      if (!res.ok) { toast.error('Failed to reject'); return }
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Post rejected')
    } finally {
      setActioning(null)
    }
  }

  async function approveAll() {
    if (!posts.length) return
    setActioning('all')
    try {
      const res = await fetch('/api/dashboard/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_all' }),
      })
      if (!res.ok) { toast.error('Failed'); return }
      const data = await res.json() as { approved: number }
      setPosts([])
      toast.success(`${data.approved} posts approved`)
    } finally {
      setActioning(null)
    }
  }

  function startEdit(post: PendingPost) {
    setEditingId(post.id)
    setEditContent(post.content)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            Pending Approval
            {posts.length > 0 && (
              <span className="text-base font-normal bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
                {posts.length}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">AI-generated posts waiting for your review</p>
        </div>
        {posts.length > 1 && (
          <Button
            className="bg-black text-white hover:bg-gray-800 gap-2"
            onClick={approveAll}
            disabled={actioning === 'all'}
          >
            {actioning === 'all'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</>
              : <><CheckCircle2 className="w-4 h-4" /> Approve all ({posts.length})</>
            }
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">All caught up</p>
          <p className="text-gray-400 text-xs mt-1">No posts waiting for approval</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-5 border-gray-100">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {post.profiles?.name && (
                      <span className="text-xs font-medium text-gray-600">{post.profiles.name}</span>
                    )}
                    <span className="text-gray-300">·</span>
                    <Badge variant="secondary" className="text-[10px] py-0 h-4 capitalize">
                      {post.source === 'ai_generated' ? 'AI generated' : post.source}
                    </Badge>
                    {post.scheduled_for && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-600">
                        <Clock className="w-3 h-3" />
                        {new Date(post.scheduled_for).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    )}
                    <div className="flex gap-1 ml-auto">
                      {post.platforms.slice(0, 5).map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px] py-0 h-4">
                          {PLATFORM_LABELS[p as Platform]?.split(' ')[0] ?? p}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Content — editable */}
                  {editingId === post.id ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-24 text-sm mb-3"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4 mb-3">{post.content}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingId === post.id ? (
                      <>
                        <Button
                          size="sm"
                          className="bg-black text-white hover:bg-gray-800 gap-1.5 text-xs h-8"
                          onClick={() => approve(post.id, editContent)}
                          disabled={actioning === post.id}
                        >
                          {actioning === post.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><Send className="w-3 h-3" /> Approve edited</>
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs h-8"
                          onClick={() => approve(post.id)}
                          disabled={actioning === post.id}
                        >
                          {actioning === post.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><CheckCircle2 className="w-3 h-3" /> Approve</>
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 gap-1.5"
                          onClick={() => startEdit(post)}
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => reject(post.id)}
                          disabled={actioning === post.id}
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </Button>
                      </>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
