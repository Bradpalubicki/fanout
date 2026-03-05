import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "White-Label Social Media API: What Agencies Need to Know — Fanout",
  description:
    "Not all social APIs offer white-label capabilities. We break down what true white-labeling looks like — custom domains, branded dashboards, per-client API keys — and how to evaluate vendors.",
  alternates: { canonical: "https://fanout.digital/blog/white-label-social-api" },
  openGraph: {
    title: "White-Label Social Media API: What Agencies Need to Know",
    description: "Custom domains, branded dashboards, per-client API keys — what true white-labeling requires.",
    url: "https://fanout.digital/blog/white-label-social-api",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "White-Label Social Media API: What Agencies Need to Know",
  datePublished: "2026-02-10",
  dateModified: "2026-03-01",
  author: { "@type": "Organization", name: "Fanout", url: "https://fanout.digital" },
  publisher: { "@type": "Organization", name: "Fanout", url: "https://fanout.digital" },
};

export default function BlogPost() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <div className="min-h-screen bg-white">
        <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
            <Link href="/"><Image src="/fanout-logo.svg" alt="Fanout" width={100} height={28} /></Link>
            <div className="flex items-center gap-4">
              <Link href="/blog" className="text-sm text-gray-500 hover:text-black transition-colors">← Blog</Link>
              <Link href="/sign-up" className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">Get started free</Link>
            </div>
          </div>
        </nav>

        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <span className="inline-block bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-full mb-4">Guide</span>
            <h1 className="text-4xl sm:text-5xl font-black text-black mb-4 leading-tight">
              White-Label Social Media API: What Agencies Need to Know
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>February 10, 2026</span><span>·</span><span>7 min read</span>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              &quot;White-label&quot; means different things to different vendors. For some, it&apos;s a logo swap. For others, it&apos;s full brand control — custom domain, branded email notifications, per-client login, and your agency&apos;s name on every touchpoint. Here&apos;s how to tell the difference.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">What true white-labeling requires</h2>
            {[
              {
                title: "Custom domain",
                body: "Your clients should log in to social.youragency.com — not fanout.digital or ayrshare.com. A custom domain keeps your brand front-and-center and prevents clients from going directly to the vendor. This is the minimum bar for white-label.",
              },
              {
                title: "Branded dashboard",
                body: "The dashboard your clients see should have your logo, your color palette, and your name. No vendor watermarks, no \"Powered by X\" banners. Clients should not know which underlying API you're using.",
              },
              {
                title: "Per-client API keys",
                body: "Each client should have their own API key that scopes to only their content. If a client asks \"can I get API access?\", they should get a key that works for their account only — not a master key that exposes all your other clients.",
              },
              {
                title: "Branded email notifications",
                body: "Post confirmations, failure alerts, and billing receipts should come from your domain. yourname@youragency.com, not noreply@thirdpartyvendor.com.",
              },
              {
                title: "Client-facing login",
                body: "Clients should be able to log in to approve posts, view their analytics, and connect their accounts — from your branded URL, with your branding, without any indication they're using a third-party platform.",
              },
            ].map((item) => (
              <div key={item.title} className="mb-6">
                <h3 className="text-lg font-bold text-black mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}

            <h2 className="text-2xl font-black text-black mt-10 mb-4">What most vendors actually offer</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Most social media APIs offer zero white-labeling below their enterprise tier. Ayrshare requires enterprise pricing for white-label. LATE has no white-label at any tier. They&apos;re developer tools — they don&apos;t expect you to show the dashboard to clients.
            </p>
            <p className="text-gray-600 leading-relaxed mb-8">
              OnlySocial offers full white-label at $97/mo, which is excellent value — but it&apos;s a no-code SaaS, not a developer API. You can&apos;t embed it in your product or call it programmatically from your codebase.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Fanout&apos;s white-label plan</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Fanout&apos;s White-Label plan at $399/mo includes:
            </p>
            <ul className="space-y-2 mb-8">
              {[
                "Custom domain — point social.yourdomain.com to your Fanout instance",
                "Unlimited profiles — no cap on client accounts",
                "Per-profile API keys — clients get scoped keys for their account only",
                "Branded dashboard — your logo and name on every page",
                "Dedicated support — direct access to the team for onboarding and issues",
                "All 9 platforms — Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, Threads",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-gray-600">
                  <span className="text-emerald-500 mt-1 shrink-0 font-bold">✓</span>{item}
                </li>
              ))}
            </ul>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">The build vs buy math</h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              Building all of this in-house — OAuth management for 9 platforms, multi-tenant data isolation, retry infrastructure, white-label dashboard — is realistically a 3-4 month engineering project at $150-200/hr. That&apos;s $80,000-160,000 before you&apos;ve written a single line of your actual product. Fanout&apos;s White-Label plan at $399/mo pays for itself in the first month.
            </p>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center">
              <h3 className="text-xl font-black text-black mb-2">Start with white-label in mind</h3>
              <p className="text-gray-500 mb-5">Contact us about the White-Label plan. Or start with Agency at $199/mo.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 bg-black text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
                  Start Agency free →
                </Link>
                <Link href="mailto:brad@nustack.digital" className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                  Contact about White-Label
                </Link>
              </div>
            </div>
          </div>
        </article>

        <footer className="py-10 border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/"><Image src="/fanout-logo.svg" alt="Fanout" width={90} height={24} /></Link>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/blog" className="hover:text-black transition-colors">Blog</Link>
              <Link href="/docs" className="hover:text-black transition-colors">Docs</Link>
              <Link href="/pricing" className="hover:text-black transition-colors">Pricing</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
