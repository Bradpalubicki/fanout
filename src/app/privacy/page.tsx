import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Fanout',
  description: 'Privacy Policy for Fanout, the social media API and automation platform.',
  alternates: { canonical: 'https://fanout.digital/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-black transition-colors">← Back to home</Link>
        </div>
        <h1 className="text-3xl font-black text-black mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-black mb-3">1. Information We Collect</h2>
            <p>Fanout collects information you provide when creating an account, connecting social media profiles, and using the platform. This includes your email address, organization name, and OAuth tokens for connected social media platforms.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">2. How We Use Your Information</h2>
            <p>We use collected information to provide and improve the Fanout service, including distributing posts to connected social platforms, generating analytics, and sending transactional notifications about your account.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">3. OAuth Tokens and Platform Access</h2>
            <p>When you connect a social media platform, Fanout stores encrypted OAuth access tokens to post on your behalf. Tokens are encrypted at rest using AES-256 encryption. We never store platform passwords. You can revoke access at any time from the Profiles settings page.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">4. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. Post history and analytics are retained for 12 months. You may request deletion of your data by contacting brad@nustack.digital.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">5. Third-Party Services</h2>
            <p>Fanout integrates with Clerk (authentication), Supabase (data storage), and social media platforms you connect. Each service has its own privacy policy. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">6. Security</h2>
            <p>We implement industry-standard security measures including encrypted data transmission (TLS), encrypted token storage, and access controls. No system is 100% secure — please use strong passwords and protect your account credentials.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-black mb-3">7. Contact</h2>
            <p>Questions about this Privacy Policy? Contact us at <a href="mailto:brad@nustack.digital" className="underline">brad@nustack.digital</a> or NuStack Digital Ventures LLC.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
