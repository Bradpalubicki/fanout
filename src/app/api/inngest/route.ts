import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { fanOutPost } from '@/inngest/functions/fan-out-post'
import { scheduledPost } from '@/inngest/functions/scheduled-post'
import { retryFailedPosts } from '@/inngest/functions/retry-failed'
import { retryPost } from '@/inngest/functions/retry-post'
import { backfillHistory } from '@/inngest/functions/backfill-history'
import { collectAccountAnalytics } from '@/inngest/functions/collect-account-analytics'
import { refreshExpiringTokens, refreshSingleToken } from '@/inngest/functions/refresh-tokens'
import { collectAnalytics } from '@/inngest/functions/collect-analytics'
import { rssAutoPost, rssCheckFeed } from '@/inngest/functions/rss-auto-post'
import { collectInbox } from '@/inngest/functions/collect-inbox'
import { trialExpiryNudge } from '@/inngest/functions/trial-expiry-nudge'
import { activationNudge } from '@/inngest/functions/activation-nudge'
import { cleanupRateLimitLogs } from '@/inngest/functions/cleanup-rate-limit-logs'
import { createAndConnectAccountFn } from '@/inngest/functions/account-creation'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    fanOutPost,
    scheduledPost,
    retryFailedPosts,
    retryPost,
    backfillHistory,
    collectAccountAnalytics,
    refreshExpiringTokens,
    refreshSingleToken,
    collectAnalytics,
    rssAutoPost,
    rssCheckFeed,
    collectInbox,
    trialExpiryNudge,
    activationNudge,
    cleanupRateLimitLogs,
    createAndConnectAccountFn,
  ],
})
