import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { fanOutPost } from '@/inngest/functions/fan-out-post'
import { scheduledPost } from '@/inngest/functions/scheduled-post'
import { retryFailedPosts } from '@/inngest/functions/retry-failed'
import { refreshExpiringTokens, refreshSingleToken } from '@/inngest/functions/refresh-tokens'
import { collectAnalytics } from '@/inngest/functions/collect-analytics'
import { rssAutoPost } from '@/inngest/functions/rss-auto-post'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fanOutPost,
    scheduledPost,
    retryFailedPosts,
    refreshExpiringTokens,
    refreshSingleToken,
    collectAnalytics,
    rssAutoPost,
  ],
})
