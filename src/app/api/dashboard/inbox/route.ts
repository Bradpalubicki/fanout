export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'
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
    // Fetch access token for this platform + profile
    const { data: token } = await supabase
      .from('oauth_tokens')
      .select('access_token, platform_page_id')
      .eq('profile_id', item.profile_id)
      .eq('platform', item.platform)
      .single()

    if (!token) {
      return NextResponse.json(
        { error: 'This profile is not connected. Reconnect the account and try again.' },
        { status: 409 }
      )
    }

    try {
      // access_token is stored encrypted — sendPlatformReply puts this straight
      // into an Authorization header / access_token param, so it must be plaintext.
      await sendPlatformReply({
        platform: item.platform,
        type: item.type,
        platformItemId: item.platform_item_id as string,
        reply,
        accessToken: await decryptToken(token.access_token as string),
        pageId: token.platform_page_id as string | null,
      })
    } catch (e) {
      // The send did NOT reach the platform. Marking this 'replied' would tell
      // the operator a customer was answered who was not. Report the failure and
      // leave the item in its current status so it stays in the queue.
      const message = e instanceof Error ? e.message : String(e)
      console.error(
        `[inbox] reply failed item=${id} platform=${item.platform}: ${message}`
      )
      return NextResponse.json(
        { error: 'Reply was not delivered', detail: message },
        { status: 502 }
      )
    }

    updateData.status = 'replied'
  }

  const { error: updateError } = await supabase
    .from('inbox_items')
    .update(updateData)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }

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
    // This endpoint posts a PUBLIC comment. `type` previously only chose the
    // target id, so a 'dm' reply was published as a public comment on the page
    // — a private-to-public disclosure (found by CX 2026-09-23). Latent today
    // because the collector never writes type='dm', but it must fail loudly
    // rather than publish the moment DM ingestion lands.
    if (type !== 'comment' && type !== 'mention') {
      throw new Error(
        `Cannot reply to a '${type}' on ${platform}: only comments and mentions have a public reply path. ` +
          `DM replies require the Messages API, which is not implemented.`
      )
    }
    const targetId = platformItemId
    const res = await fetch(`https://graph.facebook.com/v19.0/${targetId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply, access_token: accessToken }),
    })
    await assertDelivered(res, platform)
  } else if (platform === 'twitter') {
    // Twitter v2 reply
    const tweetIdMatch = platformItemId.match(/(\d+)$/)
    const tweetId = tweetIdMatch?.[1] ?? platformItemId
    const res = await fetch('https://api.twitter.com/2/tweets', {
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
    await assertDelivered(res, platform)
  } else if (platform === 'youtube') {
    // YouTube comment reply
    const res = await fetch(
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
    await assertDelivered(res, platform)
  } else if (platform === 'linkedin') {
    // LinkedIn comment reply
    const res = await fetch(
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
    await assertDelivered(res, platform)
  } else {
    // No transport exists for this platform. Silently doing nothing here would
    // mark the item 'replied' with zero network calls.
    throw new Error(`Replying is not supported for platform '${platform}'`)
  }
}

/**
 * fetch() resolves on 4xx/5xx — it only rejects on a network-level failure.
 * Every reply transport must call this, or a platform-rejected reply is
 * indistinguishable from a delivered one and the item gets marked 'replied'.
 */
async function assertDelivered(res: Response, platform: string): Promise<void> {
  if (res.ok) return
  let detail = ''
  try {
    detail = (await res.text()).slice(0, 300)
  } catch {
    // body unreadable — status alone is enough to fail on
  }
  throw new Error(`${platform} rejected the reply (HTTP ${res.status}): ${detail}`)
}
