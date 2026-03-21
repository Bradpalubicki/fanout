import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'

export const activationNudge = inngest.createFunction(
  { id: 'activation-nudge', concurrency: 1 },
  { cron: '0 */12 * * *' }, // every 12 hours
  async ({ step }) => {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey || resendKey === 'placeholder') return { skipped: true }

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)

    // Orgs signed up >48h ago, still trialing, never activated, have at least one profile
    const { data: subs } = await supabase
      .from('org_subscriptions')
      .select('org_id, created_at')
      .eq('status', 'trialing')
      .is('activated_at', null)
      .lte('created_at', cutoff.toISOString())

    if (!subs || subs.length === 0) return { sent: 0 }

    // Filter to orgs that have profiles (setup done) but zero posts
    await step.run('send-nudges', async () => {
      const Resend = (await import('resend')).Resend
      const resend = new Resend(resendKey)

      for (const sub of subs) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', sub.org_id)
          .limit(1)

        if (!profiles || profiles.length === 0) continue

        const profileIds = profiles.map((p) => p.id)
        const { count: postCount } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .in('profile_id', profileIds)

        if ((postCount ?? 0) > 0) continue

        await resend.emails.send({
          from: 'Fanout <noreply@fanout.digital>',
          to: 'brad@nustack.digital',
          subject: 'Your Fanout profiles are ready — make your first post',
          html: `<p>Your Fanout setup is complete, but you haven't posted yet.</p>
                 <p>Connect your social accounts and make your first post — it takes 60 seconds.</p>
                 <p><a href="https://fanout.digital/dashboard/compose">Make your first post →</a></p>`,
        })
      }
    })

    return { sent: subs.length }
  }
)
