export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const platform = req.nextUrl.searchParams.get('platform') ?? 'all'
  const status = req.nextUrl.searchParams.get('status') ?? 'all'

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('org_id', orgId)

  const profileIds = (profiles ?? []).map((p) => p.id)
  if (!profileIds.length) return NextResponse.json({ items: [], unreadCount: 0 })

  let query = supabase
    .from('inbox_items')
    .select('*')
    .in('profile_id', profileIds)
    .order('received_at', { ascending: false })
    .limit(100)

  if (platform !== 'all') query = query.eq('platform', platform)
  if (status === 'unread') query = query.eq('status', 'unread')

  const { data: items } = await query

  const { count: unreadCount } = await supabase
    .from('inbox_items')
    .select('*', { count: 'exact', head: true })
    .in('profile_id', profileIds)
    .eq('status', 'unread')

  return NextResponse.json({ items: items ?? [], unreadCount: unreadCount ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const schema = z.object({
    id: z.string(),
    status: z.enum(['read', 'replied']).optional(),
    reply: z.string().optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { id, status, reply } = parsed.data

  // Verify ownership
  const { data: item } = await supabase
    .from('inbox_items')
    .select('id, profile_id, platform, type, post_url, platform_item_id, profiles!inner(org_id)')
    .eq('id', id)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const itemOrgId = (item.profiles as unknown as { org_id: string }).org_id
  if (itemOrgId !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: Record<string, string> = {}
  if (status) updateData.status = status

  if (reply) {
    updateData.status = 'replied'
    // Fetch access token for this platform + profile
    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('access_token, platform_page_id')
      .eq('profile_id', item.profile_id)
      .eq('platform', item.platform)
      .single()

    if (token) {
      try {
        await sendPlatformReply({
          platform: item.platform,
          type: item.type,
          platformItemId: item.platform_item_id as string,
          reply,
          accessToken: token.access_token as string,
          pageId: token.platform_page_id as string | null,
        })
      } catch {
        // Reply failed — still mark as replied locally so UI updates
      }
    }
  }

  await supabase.from('inbox_items').update(updateData).eq('id', id)

  return NextResponse.json({ success: true })
}

async function sendPlatformReply({
  platform,
  type,
  platformItemId,
  reply,
  accessToken,
  pageId,
}: {
  platform: string
  type: string
  platformItemId: string
  reply: string
  accessToken: string
  pageId: string | null
}) {
  if (platform === 'facebook' || platform === 'instagram') {
    // Graph API comment reply
    const targetId = type === 'comment' ? platformItemId : (pageId ?? 'me')
    await fetch(`https://graph.facebook.com/v19.0/${targetId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply, access_token: accessToken }),
    })
  } else if (platform === 'twitter') {
    // Twitter v2 reply
    const tweetIdMatch = platformItemId.match(/(\d+)$/)
    const tweetId = tweetIdMatch?.[1] ?? platformItemId
    await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: reply,
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    })
  } else if (platform === 'youtube') {
    // YouTube comment reply
    await fetch(
      `https://www.googleapis.com/youtube/v3/comments?part=snippet`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            parentId: platformItemId,
            textOriginal: reply,
          },
        }),
      }
    )
  } else if (platform === 'linkedin') {
    // LinkedIn comment reply
    await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(platformItemId)}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          actor: 'urn:li:person:me',
          message: { text: reply },
        }),
      }
    )
  }
}
