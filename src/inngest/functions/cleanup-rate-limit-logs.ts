import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'

export const cleanupRateLimitLogs = inngest.createFunction(
  { id: 'cleanup-rate-limit-logs', concurrency: 1 },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    await step.run('delete-old-entries', async () => {
      const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { error, count } = await supabase
        .from('api_rate_limit_log')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff)

      if (error) throw error
      return { deleted: count ?? 0 }
    })
  }
)
