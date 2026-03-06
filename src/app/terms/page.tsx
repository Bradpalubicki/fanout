import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — Fanout',
  description: 'Terms of Service for Fanout, the social media API and automation platform.',
  alternates: { canonical: 'https://fanout.digital/terms' },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-black transition-colors">← Back to home</Link>
        </div>
        <h1 className="text-3xl font-black text-black mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-black mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Fanout (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">2. Use of the Service</h2>
            <p>You may use Fanout to automate social media posting to platforms you own or have authorization to post to. You are solely responsible for the content you distribute through the Service and must comply with each platform&apos;s terms of service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">3. Prohibited Use</h2>
            <p>You may not use Fanout to distribute spam, misinformation, illegal content, or content that violates platform policies. Abuse of the Service may result in immediate account termination.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">4. Subscription and Billing</h2>
            <p>Paid plans are billed monthly. All payments are processed by Square. Subscriptions auto-renew unless cancelled. Refunds are not provided for partial billing periods. You may cancel at any time from the Billing page.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">5. Service Availability</h2>
            <p>We strive for high uptime but do not guarantee uninterrupted service. Social media platform API outages or policy changes may affect Service functionality without notice.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">6. Limitation of Liability</h2>
            <p>Fanout and NuStack Digital Ventures LLC are not liable for indirect, incidental, or consequential damages arising from use of the Service. Our liability is limited to the amount you paid for the Service in the 30 days preceding any claim.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">7. Termination</h2>
            <p>We may terminate accounts that violate these Terms. You may delete your account at any time by contacting support. Upon termination, your data will be deleted per our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">8. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Illinois, USA. Any disputes shall be resolved through binding arbitration.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">9. Contact</h2>
            <p>Questions? Contact us at <a href="mailto:brad@nustack.digital" className="underline">brad@nustack.digital</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
