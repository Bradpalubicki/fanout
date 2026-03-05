import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "How to Build a Multi-Tenant Social Media Integration — Fanout",
  description:
    "Building social posting for one account is straightforward. Building it for 25 client accounts — with isolated tokens, per-client analytics, and white-label branding — is a different problem. Here's how to do it right.",
  alternates: { canonical: "https://fanout.digital/blog/multi-tenant-social-api" },
  openGraph: {
    title: "How to Build a Multi-Tenant Social Media Integration",
    description: "The architecture guide for agencies managing multiple client social accounts via API.",
    url: "https://fanout.digital/blog/multi-tenant-social-api",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Build a Multi-Tenant Social Media Integration",
  datePublished: "2026-02-20",
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
            <span className="inline-block bg-purple-50 text-purple-600 text-xs font-semibold px-2.5 py-1 rounded-full mb-4">Technical</span>
            <h1 className="text-4xl sm:text-5xl font-black text-black mb-4 leading-tight">
              How to Build a Multi-Tenant Social Media Integration
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>February 20, 2026</span><span>·</span><span>10 min read</span>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              Single-account social integrations are solved. Multi-tenant — where each of your 25 clients has fully isolated credentials, analytics, and posting queues — requires a different architecture. Here&apos;s the pattern.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">The core problem: shared vs isolated state</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              When you build a social integration naively, all clients share one OAuth app. Their tokens live in the same database table. Their posts hit the same rate limit bucket. Their analytics are commingled. This creates:
            </p>
            <ul className="space-y-2 mb-8">
              {[
                "Security risk: a token leak exposes all clients, not just one",
                "Rate limit bleed: one client's burst posting throttles everyone else",
                "Debugging hell: when a post fails, which client's token expired?",
                "Billing complexity: how do you charge clients individually if usage is pooled?",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-gray-600">
                  <span className="text-red-400 mt-1 shrink-0">—</span>{item}
                </li>
              ))}
            </ul>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">The right data model</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              A proper multi-tenant social API has these entities:
            </p>
            <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm mb-8 not-prose">
              <div className="text-gray-500 mb-3">{"-- Core schema"}</div>
              <div className="text-blue-300">organizations</div>
              <div className="text-gray-400 ml-4">id, name, clerk_org_id, plan_tier</div>
              <div className="text-blue-300 mt-2">profiles</div>
              <div className="text-gray-400 ml-4">id, org_id, name, api_key (hashed)</div>
              <div className="text-blue-300 mt-2">platform_connections</div>
              <div className="text-gray-400 ml-4">id, profile_id, platform, access_token (encrypted), refresh_token (encrypted), expires_at</div>
              <div className="text-blue-300 mt-2">posts</div>
              <div className="text-gray-400 ml-4">id, profile_id, content, platforms, status, scheduled_for</div>
              <div className="text-blue-300 mt-2">post_results</div>
              <div className="text-gray-400 ml-4">id, post_id, platform, status, platform_post_id, error</div>
            </div>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Token encryption pattern</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Never store OAuth tokens in plaintext. AES-256-GCM with a key stored in environment variables is the standard pattern:
            </p>
            <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm mb-8 not-prose">
              <div className="text-gray-500 mb-2">{"// Encrypt before storing"}</div>
              <div className="text-green-400">{"function encryptToken(token: string): string {"}</div>
              <div className="text-gray-300 ml-4">{"const iv = crypto.randomBytes(16);"}</div>
              <div className="text-gray-300 ml-4">{"const cipher = crypto.createCipheriv("}</div>
              <div className="text-gray-300 ml-8">{'"aes-256-gcm", Buffer.from(process.env.ENCRYPTION_KEY!, "hex"), iv'}</div>
              <div className="text-gray-300 ml-4">{");"}</div>
              <div className="text-gray-300 ml-4">{"// ... return iv + authTag + encrypted"}</div>
              <div className="text-green-400">{"}"}</div>
            </div>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">The retry queue</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Social platform APIs fail. Instagram goes down. Twitter rate limits mid-batch. Your queue must handle this gracefully:
            </p>
            <ul className="space-y-2 mb-4">
              {[
                "Attempt 1: immediate",
                "Attempt 2: +30 seconds (exponential backoff)",
                "Attempt 3: +2 minutes",
                "After 3 failures: mark as failed, send email notification, allow manual retry",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-gray-600">
                  <span className="text-indigo-500 mt-1 shrink-0 font-bold">→</span>{item}
                </li>
              ))}
            </ul>
            <p className="text-gray-600 leading-relaxed mb-8">
              Fanout uses Inngest for this — a durable function runner that handles retries, scheduling, and failure tracking out of the box.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Skip the build — use Fanout</h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              This architecture takes 4-8 weeks to build correctly. Token encryption, refresh logic, retry queues, per-client rate limit tracking, analytics collection — all of it. Fanout is this infrastructure, already built, at $49/mo for 3 client profiles or $199/mo for 25.
            </p>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center">
              <h3 className="text-xl font-black text-black mb-2">Skip the 8-week build</h3>
              <p className="text-gray-500 mb-5">Full multi-tenant social API ready in 15 minutes.</p>
              <Link href="/sign-up" className="inline-flex items-center gap-2 bg-black text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
                Start free trial →
              </Link>
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
