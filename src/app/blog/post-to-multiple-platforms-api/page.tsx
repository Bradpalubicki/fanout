import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Post to Multiple Social Platforms with One API Call — Fanout",
  description:
    "A step-by-step guide to distributing content across Twitter/X, LinkedIn, Instagram, TikTok, and more with a single REST API request — no per-platform integration required.",
  alternates: { canonical: "https://fanout.digital/blog/post-to-multiple-platforms-api" },
  openGraph: {
    title: "Post to Multiple Social Platforms with One API Call",
    description: "Step-by-step guide to multi-platform social posting via a single REST API request.",
    url: "https://fanout.digital/blog/post-to-multiple-platforms-api",
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Post to Multiple Social Platforms with One API Call",
  datePublished: "2026-02-15",
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
            <span className="inline-block bg-emerald-50 text-emerald-600 text-xs font-semibold px-2.5 py-1 rounded-full mb-4">Tutorial</span>
            <h1 className="text-4xl sm:text-5xl font-black text-black mb-4 leading-tight">
              Post to Multiple Social Platforms with One API Call
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>February 15, 2026</span><span>·</span><span>5 min read</span>
            </div>
          </div>

          <div className="prose prose-gray max-w-none">
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              The fastest way to post to Twitter/X, LinkedIn, Instagram, TikTok, Facebook, YouTube, Pinterest, Reddit, and Threads simultaneously is one authenticated POST request. Here&apos;s the exact workflow.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Step 1: Get your API key</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              After signing up and creating a profile, your API key is in Settings → API Keys. Each profile gets its own key — so client A and client B each have isolated credentials.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Step 2: Connect your platforms</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              From the Profiles dashboard, connect each platform via OAuth. Fanout manages the OAuth app credentials — you just click &quot;Connect&quot; and authorize your account. Takes about 30 seconds per platform.
            </p>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Step 3: Make the API call</h2>
            <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm mb-4 not-prose">
              <div className="text-gray-500 mb-2">{"# Post to 4 platforms at once"}</div>
              <div className="text-green-400">curl -X POST https://fanout.digital/api/v1/post \</div>
              <div className="text-gray-300 ml-4">{"-H 'Authorization: Bearer YOUR_API_KEY' \\"}</div>
              <div className="text-gray-300 ml-4">{"-H 'Content-Type: application/json' \\"}</div>
              <div className="text-gray-300 ml-4">{"-d '{"}</div>
              <div className="text-gray-300 ml-8">&quot;profileId&quot;: &quot;your-profile-id&quot;,</div>
              <div className="text-gray-300 ml-8">&quot;platforms&quot;: [&quot;twitter&quot;, &quot;linkedin&quot;, &quot;instagram&quot;, &quot;facebook&quot;],</div>
              <div className="text-gray-300 ml-8">&quot;post&quot;: &quot;Excited to announce our new product launch! 🚀&quot;</div>
              <div className="text-gray-300 ml-4">{"}'"}</div>
            </div>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Step 4: Handle the response</h2>
            <p className="text-gray-600 leading-relaxed mb-4">The API returns a post ID and per-platform status:</p>
            <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm mb-8 not-prose">
              <div className="text-gray-300">{"{"}</div>
              <div className="text-gray-300 ml-4">&quot;postId&quot;: <span className="text-orange-300">&quot;post_abc123&quot;</span>,</div>
              <div className="text-gray-300 ml-4">&quot;status&quot;: <span className="text-green-400">&quot;processing&quot;</span>,</div>
              <div className="text-gray-300 ml-4">&quot;platforms&quot;: {"{"}</div>
              <div className="text-gray-300 ml-8">&quot;twitter&quot;: {"{ "}status: <span className="text-green-400">&quot;posted&quot;</span>, postId: <span className="text-orange-300">&quot;1234567890&quot;</span> {"}"}</div>
              <div className="text-gray-300 ml-8">&quot;linkedin&quot;: {"{ "}status: <span className="text-green-400">&quot;posted&quot;</span>, postId: <span className="text-orange-300">&quot;urn:li:share:abc&quot;</span> {"}"}</div>
              <div className="text-gray-300 ml-8">&quot;instagram&quot;: {"{ "}status: <span className="text-yellow-400">&quot;processing&quot;</span> {"}"}</div>
              <div className="text-gray-300 ml-8">&quot;facebook&quot;: {"{ "}status: <span className="text-green-400">&quot;posted&quot;</span>, postId: <span className="text-orange-300">&quot;987654321_abc&quot;</span> {"}"}</div>
              <div className="text-gray-300 ml-4">{"}"}</div>
              <div className="text-gray-300">{"}"}</div>
            </div>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Optional: schedule for later</h2>
            <p className="text-gray-600 leading-relaxed mb-4">Add a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">scheduledFor</code> field to post at a specific time:</p>
            <div className="bg-gray-900 rounded-xl p-5 font-mono text-sm mb-8 not-prose">
              <div className="text-gray-300">{"{"}</div>
              <div className="text-gray-300 ml-4">&quot;profileId&quot;: <span className="text-orange-300">&quot;your-profile-id&quot;</span>,</div>
              <div className="text-gray-300 ml-4">&quot;platforms&quot;: <span className="text-blue-300">[&quot;twitter&quot;, &quot;linkedin&quot;]</span>,</div>
              <div className="text-gray-300 ml-4">&quot;post&quot;: <span className="text-orange-300">&quot;Monday morning content drop 📅&quot;</span>,</div>
              <div className="text-gray-300 ml-4">&quot;scheduledFor&quot;: <span className="text-orange-300">&quot;2026-03-10T09:00:00Z&quot;</span></div>
              <div className="text-gray-300">{"}"}</div>
            </div>

            <h2 className="text-2xl font-black text-black mt-10 mb-4">Optional: AI-generated platform variants</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Add <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">&quot;aiVariants&quot;: true</code> and instead of one post going to all platforms, Claude generates platform-optimized variants — punchy for Twitter, professional for LinkedIn, hashtag-rich for Instagram.
            </p>

            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center">
              <h3 className="text-xl font-black text-black mb-2">Try it in 15 minutes</h3>
              <p className="text-gray-500 mb-5">Free 14-day trial. No credit card. Full API access on day one.</p>
              <Link href="/sign-up" className="inline-flex items-center gap-2 bg-black text-white font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
                Start free →
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
