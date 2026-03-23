export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ExternalLink } from 'lucide-react'

interface BiolinkPage {
  id: string
  handle: string
  title: string
  bio: string | null
  avatar_url: string | null
  background_color: string | null
  button_style: 'rounded' | 'pill' | 'square' | null
  links: Array<{ title: string; url: string; icon?: string }>
  is_published: boolean
}

interface Props {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({ params }: Props) {
  const { handle } = await params
  const { data: page } = await supabase
    .from('biolink_pages')
    .select('title, bio')
    .eq('handle', handle)
    .eq('is_published', true)
    .single()

  if (!page) return { title: 'Not found' }
  return { title: page.title, description: page.bio ?? undefined }
}

export default async function BiolinkPublicPage({ params }: Props) {
  const { handle } = await params

  const { data: page } = await supabase
    .from('biolink_pages')
    .select('*')
    .eq('handle', handle)
    .eq('is_published', true)
    .single()

  if (!page) notFound()

  const biolinkPage = page as BiolinkPage

  const buttonRadius: Record<string, string> = {
    rounded: 'rounded-lg',
    pill: 'rounded-full',
    square: 'rounded-none',
  }
  const btnStyle = buttonRadius[biolinkPage.button_style ?? 'rounded'] ?? 'rounded-lg'
  const bgColor = biolinkPage.background_color ?? '#ffffff'

  return (
    <div
      className="min-h-screen flex flex-col items-center py-12 px-4"
      style={{ backgroundColor: bgColor }}
    >
      <div className="w-full max-w-sm">
        {/* Avatar */}
        {biolinkPage.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={biolinkPage.avatar_url}
            alt={biolinkPage.title}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-white shadow-lg"
          />
        )}

        {/* Name + bio */}
        <h1 className="text-xl font-bold text-center text-gray-900 mb-2">{biolinkPage.title}</h1>
        {biolinkPage.bio && (
          <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">{biolinkPage.bio}</p>
        )}

        {/* Links */}
        <div className="space-y-3">
          {(biolinkPage.links ?? []).map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between w-full px-5 py-3.5 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors ${btnStyle}`}
              onClick={async () => {
                // Track click server-side
                await fetch('/api/biolink/track', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pageId: biolinkPage.id, linkIndex: i }),
                }).catch(() => null)
              }}
            >
              <span>{link.title}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          ))}
        </div>

        {/* Powered by */}
        <div className="mt-10 text-center">
          <a href="https://fanout.digital" className="text-xs text-gray-400 hover:text-gray-600">
            Powered by Fanout
          </a>
        </div>
      </div>
    </div>
  )
}
