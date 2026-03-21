import { inngest } from '@/lib/inngest'
import { supabase } from '@/lib/supabase'

export const trialExpiryNudge = inngest.createFunction(
  { id: 'trial-expiry-nudge', concurrency: 1 },
  { cron: '0 10 * * *' }, // daily at 10am UTC
  async ({ step }) => {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey || resendKey === 'placeholder') return { skipped: true }

    const now = new Date()
    const in4Days = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)

    // Find trialing orgs expiring within 4 days with no activated_at and no nudge sent
    const { data: subs } = await supabase
      .from('org_subscriptions')
      .select('org_id, trial_expires_at')
      .eq('status', 'trialing')
      .is('activated_at', null)
      .lte('trial_expires_at', in4Days.toISOString())
      .gt('trial_expires_at', now.toISOString())

    if (!subs || subs.length === 0) return { sent: 0 }

    await step.run('send-nudges', async () => {
      const Resend = (await import('resend')).Resend
      const resend = new Resend(resendKey)

      for (const sub of subs) {
        const daysLeft = Math.max(1, Math.ceil(
          (new Date(sub.trial_expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ))

        // Get org member email via Supabase profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', sub.org_id)
          .limit(1)

        if (!profiles || profiles.length === 0) continue

        // We don't store user email in Supabase — send to admin for now
        // TODO: wire to Clerk org membership email when available
        await resend.emails.send({
          from: 'Fanout <noreply@fanout.digital>',
          to: 'brad@nustack.digital',
          subject: `Fanout trial ending in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          html: `<p>Your Fanout free trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
                 <p>Connect your first social platform and make your first post to see Fanout in action — then upgrade to keep it going.</p>
                 <p><a href="https://fanout.digital/dashboard/billing">Upgrade now →</a></p>`,
        })
      }
    })

    return { sent: subs.length }
  }
)
