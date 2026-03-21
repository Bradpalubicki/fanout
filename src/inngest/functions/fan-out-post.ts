import { inngest } from '@/lib/inngest'
import { fanOut } from '@/lib/fan-out'
import { supabase } from '@/lib/supabase'

export const fanOutPost = inngest.createFunction(
  {
    id: 'fan-out-post',
    retries: 3,
    onFailure: async ({ event, error }) => {
      const { postId, profileId, platforms } = event.data.event.data as {
        postId: string
        profileId: string
        platforms: string[]
      }

      const resendKey = process.env.RESEND_API_KEY
      if (!resendKey || resendKey === 'placeholder') return

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', profileId)
        .single()

      if (!profile) return

      const Resend = (await import('resend')).Resend
      const resend = new Resend(resendKey)

      const platformList = (platforms as string[]).join(', ')

      await resend.emails.send({
        from: 'Fanout <noreply@fanout.digital>',
        to: 'brad@nustack.digital',
        subject: `Post to ${platformList} failed`,
        html: `<p>Your post (ID: <code>${postId}</code>) to <strong>${platformList}</strong> failed after 3 attempts.</p>
               <p>Reason: ${error.message}</p>
               <p><a href="https://fanout.digital/dashboard/compose">Retry in Fanout →</a></p>`,
      })
    },
  },
  { event: 'social/post.created' },
  async ({ event, step }) => {
    const { postId, profileId, platforms } = event.data as {
      postId: string
      profileId: string
      platforms: string[]
    }

    const results = await step.run('fan-out-to-platforms', async () => {
      return fanOut(postId, platforms, profileId)
    })

    // Send failure email if all platforms failed
    const allFailed = results.every((r) => !r.success)
    if (allFailed) {
      await step.run('notify-failure', async () => {
        const resendKey = process.env.RESEND_API_KEY
        if (!resendKey || resendKey === 'placeholder') return

        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', profileId)
          .single()

        if (!profile) return

        const Resend = (await import('resend')).Resend
        const resend = new Resend(resendKey)

        const failedPlatforms = results
          .filter((r) => !r.success)
          .map((r) => r.platform)
          .join(', ')

        const errors = results
          .filter((r) => !r.success && r.error)
          .map((r) => `${r.platform}: ${r.error}`)
          .join('<br/>')

        await resend.emails.send({
          from: 'Fanout <noreply@fanout.digital>',
          to: 'brad@nustack.digital',
          subject: `Post to ${failedPlatforms} failed`,
          html: `<p>Your post to <strong>${failedPlatforms}</strong> failed after 3 attempts.</p>
                 <p>Reason:<br/>${errors}</p>
                 <p><a href="https://fanout.digital/dashboard/compose">Retry in Fanout →</a></p>`,
        })
      })
    }

    // Set activated_at on first successful post if not already set
    const anySuccess = results.some((r) => r.success)
    if (anySuccess) {
      await step.run('set-activated-at', async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', profileId)
          .single()
        if (!profile) return
        await supabase
          .from('org_subscriptions')
          .update({ activated_at: new Date().toISOString() })
          .eq('org_id', profile.org_id)
          .is('activated_at', null)
      })
    }

    return { postId, results }
  }
)
