import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface RssFeed {
  id: string
  profile_id: string
  url: string
  last_item_guid: string | null
  auto_post: boolean
  profiles: { org_id: string; oauth_tokens: { platform: string }[] }
}

interface RssItem {
  guid: string
  title: string
  description: string
  link: string
  pubDate: string
}

async function fetchRssFeed(url: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Fanout RSS Reader/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const xml = await res.text()

    // Simple XML parser for RSS items
    const items: RssItem[] = []
    const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)

    for (const match of itemMatches) {
      const content = match[1]
      const get = (tag: string) => {
        const m = content.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
        return m?.[1] ?? m?.[2] ?? ''
      }

      const guid = get('guid') || get('link')
      const title = get('title')
      const description = get('description')
      const link = get('link')
      const pubDate = get('pubDate')

      if (guid && title) {
        items.push({ guid: guid.trim(), title: title.trim(), description: description.trim(), link: link.trim(), pubDate })
      }
      if (items.length >= 10) break
    }

    return items
  } catch {
    return []
  }
}

async function generateSocialPost(article: RssItem, platforms: string[]): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Write a social media post promoting this blog article. Keep it engaging and under 250 characters for Twitter compatibility.

Article title: ${article.title}
Article summary: ${article.description.slice(0, 500)}
URL: ${article.link}

Write ONLY the post text. Include the URL at the end. No preamble.`,
    }],
  })
  return (msg.content[0] as { type: string; text: string }).text.trim()
}

export const rssAutoPost = inngest.createFunction(
  {
    id: 'rss-auto-post',
    retries: 2,
  },
  // Run every hour
  { cron: '0 * * * *' },
  async ({ step }) => {
    const results: { feedId: string; newItems: number }[] = []

    // Get all active RSS feeds
    const feedRows = await step.run('fetch-feeds', async () => {
      const { data } = await supabase
        .from('rss_feeds')
        .select('*, profiles(org_id, oauth_tokens(platform))')
        .limit(50)
      return data ?? []
    })

    if (!feedRows?.length) return { processed: 0 }

    for (const feed of feedRows as unknown as RssFeed[]) {
      await step.run(`process-feed-${feed.id}`, async () => {
        const items = await fetchRssFeed(feed.url)
        if (!items.length) return

        // Find new items (not seen before)
        const newItems = feed.last_item_guid
          ? items.filter((item) => item.guid !== feed.last_item_guid).slice(0, 3)
          : items.slice(0, 1) // First run: only take latest

        if (!newItems.length) return

        const platforms = (feed.profiles.oauth_tokens ?? []).map((t) => t.platform)
        if (!platforms.length) return

        for (const item of newItems) {
          const content = await generateSocialPost(item, platforms)

          if (feed.auto_post) {
            // Auto-post directly
            await supabase.from('posts').insert({
              profile_id: feed.profile_id,
              content,
              platforms,
              status: 'pending',
              source: 'api',
            })
          } else {
            // Create as pending_approval
            await supabase.from('posts').insert({
              profile_id: feed.profile_id,
              content,
              platforms,
              status: 'pending_approval',
              source: 'ai_generated',
            })
          }
        }

        // Update last seen guid
        await supabase
          .from('rss_feeds')
          .update({ last_item_guid: items[0].guid, last_checked_at: new Date().toISOString() })
          .eq('id', feed.id)

        results.push({ feedId: feed.id, newItems: newItems.length })
      })
    }

    return { processed: results.length, results }
  }
)

// Event-triggered: check a single feed on demand
export const rssCheckFeed = inngest.createFunction(
  { id: 'rss-check-feed', retries: 1 },
  { event: 'rss/check-feed' },
  async ({ event, step }) => {
    const { feedId } = event.data as { feedId: string }

    const feed = await step.run('fetch-feed', async () => {
      const { data } = await supabase
        .from('rss_feeds')
        .select('*, profiles(org_id, oauth_tokens(platform))')
        .eq('id', feedId)
        .single()
      return data as RssFeed | null
    })

    if (!feed) return { error: 'Feed not found' }

    const items = await step.run('fetch-items', () => fetchRssFeed(feed.url))
    if (!items.length) return { newItems: 0 }

    const newItems = feed.last_item_guid
      ? items.filter((item) => item.guid !== feed.last_item_guid).slice(0, 3)
      : items.slice(0, 1)

    if (!newItems.length) return { newItems: 0 }

    const platforms = (feed.profiles.oauth_tokens ?? []).map((t) => t.platform)
    if (!platforms.length) return { newItems: 0 }

    await step.run('create-posts', async () => {
      for (const item of newItems) {
        const content = await generateSocialPost(item, platforms)
        await supabase.from('posts').insert({
          profile_id: feed.profile_id,
          content,
          platforms,
          status: feed.auto_post ? 'pending' : 'pending_approval',
          source: 'ai_generated',
        })
      }
      await supabase
        .from('rss_feeds')
        .update({ last_item_guid: items[0].guid, last_checked_at: new Date().toISOString() })
        .eq('id', feedId)
    })

    return { newItems: newItems.length }
  }
)
