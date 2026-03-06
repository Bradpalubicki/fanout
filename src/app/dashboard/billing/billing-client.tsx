'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function UpgradeButton({ plan, highlight }: { plan: string; highlight?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json() as { url?: string; error?: string; message?: string }

      if (!res.ok) {
        if (res.status === 503) {
          toast.info(data.message ?? 'Payments not configured yet. Contact brad@nustack.digital.')
        } else {
          toast.error(data.error ?? 'Failed to start checkout')
        }
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      toast.error('Connection error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleUpgrade}
      disabled={loading}
      className={`w-full text-sm ${highlight ? 'bg-black text-white hover:bg-gray-800' : 'border border-gray-200 bg-white text-black hover:bg-gray-50'}`}
      variant={highlight ? 'default' : 'outline'}
    >
      {loading ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : (
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
      )}
      {loading ? 'Redirecting…' : 'Subscribe'}
    </Button>
  )
}
