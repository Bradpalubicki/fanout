import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog — Fanout Social Media API",
  description:
    "Guides, comparisons, and developer resources for building multi-platform social media integrations. Social media API tutorials, Ayrshare alternatives, and agency automation.",
  alternates: {
    canonical: "https://fanout.digital/blog",
  },
  openGraph: {
    title: "Blog — Fanout Social Media API",
    description:
      "Guides, comparisons, and developer resources for social media API integrations.",
    url: "https://fanout.digital/blog",
  },
};

const POSTS = [
  {
    slug: "social-media-api-for-agencies",
    title: "The Best Social Media API for Agencies in 2026",
    excerpt:
      "Managing social posting for multiple clients means you need more than a single-account API. Here's what to look for — and why multi-tenant architecture matters.",
    date: "March 1, 2026",
    readTime: "6 min read",
    tag: "Guide",
    tagColor: "bg-blue-50 text-blue-600",
  },
  {
    slug: "ayrshare-alternative-2026",
    title: "Ayrshare Alternative in 2026: Full Comparison",
    excerpt:
      "Ayrshare is the most well-known social media API, but it's not the only option. We compare pricing, token ownership, white-label capabilities, and AI features across the top alternatives.",
    date: "February 28, 2026",
    readTime: "8 min read",
    tag: "Comparison",
    tagColor: "bg-red-50 text-red-600",
  },
  {
    slug: "multi-tenant-social-api",
    title: "How to Build a Multi-Tenant Social Media Integration",
    excerpt:
      "Building social posting for one account is easy. Building it for 25 client accounts — with isolated tokens, per-client analytics, and white-label branding — is a different problem entirely.",
    date: "February 20, 2026",
    readTime: "10 min read",
    tag: "Technical",
    tagColor: "bg-purple-50 text-purple-600",
  },
  {
    slug: "post-to-multiple-platforms-api",
    title: "Post to Multiple Social Platforms with One API Call",
    excerpt:
      "A step-by-step guide to distributing content across Twitter/X, LinkedIn, Instagram, TikTok, and more with a single REST API request — no per-platform integration required.",
    date: "February 15, 2026",
    readTime: "5 min read",
    tag: "Tutorial",
    tagColor: "bg-emerald-50 text-emerald-600",
  },
  {
    slug: "white-label-social-api",
    title: "White-Label Social Media API: What Agencies Need to Know",
    excerpt:
      "Not all social APIs offer white-label capabilities. We break down what true white-labeling looks like — custom domains, branded dashboards, per-client API keys — and how to evaluate vendors.",
    date: "February 10, 2026",
    readTime: "7 min read",
    tag: "Guide",
    tagColor: "bg-blue-50 text-blue-600",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center">
            <Image src="/fanout-logo.svg" alt="Fanout" width={100} height={28} />
          </Link>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/#features" className="hover:text-black transition-colors hidden md:block">Features</Link>
            <Link href="/pricing" className="hover:text-black transition-colors hidden md:block">Pricing</Link>
            <Link href="/docs" className="hover:text-black transition-colors hidden md:block">Docs</Link>
          </div>
          <Link
            href="/sign-up"
            className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <h1 className="text-4xl sm:text-5xl font-black text-black mb-4">Blog</h1>
        <p className="text-lg text-gray-500 max-w-xl">
          Developer guides, API comparisons, and agency automation resources.
        </p>
      </div>

      {/* Posts */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {/* Featured post */}
        <Link href={`/blog/${POSTS[0].slug}`} className="block group mb-8">
          <div className="bg-gray-950 rounded-2xl p-8 sm:p-10 hover:bg-gray-900 transition-colors">
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-4 ${POSTS[0].tagColor}`}>
              {POSTS[0].tag}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-tight group-hover:text-indigo-300 transition-colors">
              {POSTS[0].title}
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">{POSTS[0].excerpt}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{POSTS[0].date}</span>
                <span>·</span>
                <span>{POSTS[0].readTime}</span>
              </div>
              <span className="text-indigo-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Read article <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {POSTS.slice(1).map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-gray-300 hover:shadow-sm transition-all h-full flex flex-col">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-4 self-start ${post.tagColor}`}>
                  {post.tag}
                </span>
                <h2 className="text-lg font-bold text-black mb-2 leading-snug group-hover:text-indigo-600 transition-colors flex-1">
                  {post.title}
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{post.date}</span>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/fanout-logo.svg" alt="Fanout" width={90} height={24} />
            <span className="text-gray-300 text-sm">· by NuStack Digital Ventures</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/blog" className="hover:text-black transition-colors">Blog</Link>
            <Link href="/docs" className="hover:text-black transition-colors">Docs</Link>
            <Link href="/pricing" className="hover:text-black transition-colors">Pricing</Link>
            <Link href="/sign-in" className="hover:text-black transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
