import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'

interface OAuthToken {
  profile_id: string
  platform: string
  access_token: string
  platform_page_id: string | null
}

interface InboxInsert {
  profile_id: string
  platform: string
  type: 'comment' | 'dm' | 'mention'
  sender_name: string
  sender_avatar: string | null
  content: string
  post_url: string | null
  platform_item_id: string
  status: 'unread'
  received_at: string
}

// ─── Facebook: fetch page comments ───────────────────────────────────────────
async function fetchFacebookItems(token: OAuthToken): Promise<InboxInsert[]> {
  const pageId = token.platform_page_id ?? 'me'
  try {
    const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed?fields=id,message,comments{from,message,created_time}&since=${since}&access_token=${token.access_token}&limit=25`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = await res.json() as {
      data?: Array<{
        id: string
        message?: string
        comments?: { data: Array<{ id: string; from?: { name: string }; message: string; created_time: string }> }
      }>
    }

    const items: InboxInsert[] = []
    for (const post of data.data ?? []) {
      for (const comment of post.comments?.data ?? []) {
        items.push({
          profile_id: token.profile_id,
          platform: 'facebook',
          type: 'comment',
          sender_name: comment.from?.name ?? 'Unknown',
          sender_avatar: null,
          content: comment.message,
          post_url: `https://www.facebook.com/${post.id.replace('_', '/posts/')}`,
          platform_item_id: comment.id,
          status: 'unread',
          received_at: comment.created_time,
        })
      }
    }
    return items
  } catch {
    return []
  }
}

// ─── Instagram: fetch media comments ─────────────────────────────────────────
async function fetchInstagramItems(token: OAuthToken): Promise<InboxInsert[]> {
  const igUserId = token.platform_page_id
  if (!igUserId) return []
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,timestamp,comments{from,text,timestamp}&limit=10&access_token=${token.access_token}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = await res.json() as {
      data?: Array<{
        id: string
        caption?: string
        comments?: { data: Array<{ id: string; from?: { username: string }; text: string; timestamp: string }> }
      }>
    }

    const items: InboxInsert[] = []
    for (const media of data.data ?? []) {
      for (const comment of media.comments?.data ?? []) {
        items.push({
          profile_id: token.profile_id,
          platform: 'instagram',
          type: 'comment',
          sender_name: comment.from?.username ?? 'Unknown',
          sender_avatar: null,
          content: comment.text,
          post_url: `https://www.instagram.com/p/${media.id}/`,
          platform_item_id: comment.id,
          status: 'unread',
          received_at: comment.timestamp,
        })
      }
    }
    return items
  } catch {
    return []
  }
}

// ─── Twitter/X: fetch mentions ────────────────────────────────────────────────
async function fetchTwitterItems(token: OAuthToken): Promise<InboxInsert[]> {
  try {
    // First get the authenticated user's ID
    const meRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!meRes.ok) return []
    const meData = await meRes.json() as { data?: { id: string; username: string } }
    const userId = meData.data?.id
    if (!userId) return []

    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const res = await fetch(
      `https://api.twitter.com/2/users/${userId}/mentions?max_results=20&start_time=${startTime}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=name,username`,
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return []
    const data = await res.json() as {
      data?: Array<{ id: string; text: string; created_at: string; author_id: string }>
      includes?: { users?: Array<{ id: string; name: string; username: string }> }
    }

    const userMap: Record<string, string> = {}
    for (const u of data.includes?.users ?? []) {
      userMap[u.id] = u.name ?? u.username
    }

    return (data.data ?? []).map((tweet) => ({
      profile_id: token.profile_id,
      platform: 'twitter',
      type: 'mention' as const,
      sender_name: userMap[tweet.author_id] ?? 'Unknown',
      sender_avatar: null,
      content: tweet.text,
      post_url: `https://twitter.com/i/web/status/${tweet.id}`,
      platform_item_id: tweet.id,
      status: 'unread' as const,
      received_at: tweet.created_at,
    }))
  } catch {
    return []
  }
}

// ─── LinkedIn: fetch post comments ───────────────────────────────────────────
async function fetchLinkedInItems(token: OAuthToken): Promise<InboxInsert[]> {
  try {
    // Get recent posts
    const postsRes = await fetch(
      'https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:person:me&count=5',
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!postsRes.ok) return []
    const postsData = await postsRes.json() as {
      elements?: Array<{ id: string; activity?: string }>
    }

    const items: InboxInsert[] = []
    for (const post of (postsData.elements ?? []).slice(0, 3)) {
      if (!post.activity) continue
      const commentsRes = await fetch(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.activity)}/comments?count=10`,
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          signal: AbortSignal.timeout(10000),
        }
      )
      if (!commentsRes.ok) continue
      const commentsData = await commentsRes.json() as {
        elements?: Array<{
          id: string
          message?: { text: string }
          actor?: string
          created?: { time: number }
        }>
      }

      for (const comment of commentsData.elements ?? []) {
        items.push({
          profile_id: token.profile_id,
          platform: 'linkedin',
          type: 'comment',
          sender_name: comment.actor ?? 'LinkedIn User',
          sender_avatar: null,
          content: comment.message?.text ?? '',
          post_url: `https://www.linkedin.com/feed/update/${post.activity}/`,
          platform_item_id: comment.id,
          status: 'unread',
          received_at: comment.created?.time
            ? new Date(comment.created.time).toISOString()
            : new Date().toISOString(),
        })
      }
    }
    return items
  } catch {
    return []
  }
}

// ─── YouTube: fetch video comments ───────────────────────────────────────────
async function fetchYouTubeItems(token: OAuthToken): Promise<InboxInsert[]> {
  try {
    // Get channel's recent videos
    const videosRes = await fetch(
      'https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=5&order=date',
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!videosRes.ok) return []
    const videosData = await videosRes.json() as {
      items?: Array<{ id: { videoId: string }; snippet: { title: string } }>
    }

    const items: InboxInsert[] = []
    for (const video of (videosData.items ?? []).slice(0, 3)) {
      const videoId = video.id.videoId
      const commentsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=20&order=time`,
        {
          headers: { Authorization: `Bearer ${token.access_token}` },
          signal: AbortSignal.timeout(10000),
        }
      )
      if (!commentsRes.ok) continue
      const commentsData = await commentsRes.json() as {
        items?: Array<{
          id: string
          snippet: {
            topLevelComment: {
              snippet: {
                textDisplay: string
                authorDisplayName: string
                authorProfileImageUrl: string
                publishedAt: string
              }
            }
          }
        }>
      }

      for (const thread of commentsData.items ?? []) {
        const s = thread.snippet.topLevelComment.snippet
        items.push({
          profile_id: token.profile_id,
          platform: 'youtube',
          type: 'comment',
          sender_name: s.authorDisplayName,
          sender_avatar: s.authorProfileImageUrl ?? null,
          content: s.textDisplay,
          post_url: `https://www.youtube.com/watch?v=${videoId}`,
          platform_item_id: thread.id,
          status: 'unread',
          received_at: s.publishedAt,
        })
      }
    }
    return items
  } catch {
    return []
  }
}

// ─── Main function ────────────────────────────────────────────────────────────
export const collectInbox = inngest.createFunction(
  { id: 'collect-inbox', retries: 1 },
  { cron: '*/15 * * * *' }, // every 15 minutes
  async ({ step }) => {
    const SUPPORTED = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube']

    const tokens = await step.run('fetch-tokens', async () => {
      const { data } = await supabase
        .from('oauth_tokens')
        .select('profile_id, platform, access_token, platform_page_id')
        .in('platform', SUPPORTED)
        .limit(200)
      return (data ?? []) as OAuthToken[]
    })

    if (!tokens.length) return { processed: 0 }

    let totalNew = 0

    for (const token of tokens) {
      await step.run(`poll-${token.platform}-${token.profile_id}`, async () => {
        let newItems: InboxInsert[] = []

        if (token.platform === 'facebook') newItems = await fetchFacebookItems(token)
        else if (token.platform === 'instagram') newItems = await fetchInstagramItems(token)
        else if (token.platform === 'twitter') newItems = await fetchTwitterItems(token)
        else if (token.platform === 'linkedin') newItems = await fetchLinkedInItems(token)
        else if (token.platform === 'youtube') newItems = await fetchYouTubeItems(token)

        if (!newItems.length) return

        // Deduplicate against existing items (by platform_item_id)
        const existingIds = (await supabase
          .from('inbox_items')
          .select('platform_item_id')
          .eq('profile_id', token.profile_id)
          .eq('platform', token.platform)
          .in('platform_item_id', newItems.map((i) => i.platform_item_id))
        ).data?.map((r) => r.platform_item_id as string) ?? []

        const toInsert = newItems.filter((i) => !existingIds.includes(i.platform_item_id))
        if (!toInsert.length) return

        await supabase.from('inbox_items').insert(toInsert)
        totalNew += toInsert.length
      })
    }

    return { processed: tokens.length, newItems: totalNew }
  }
)
