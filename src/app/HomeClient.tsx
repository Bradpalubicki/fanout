"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

const PLATFORMS = [
  "X / Twitter", "LinkedIn", "Facebook", "Instagram",
  "TikTok", "Pinterest", "YouTube", "Reddit", "Threads",
];

const AGENCIES = [
  "Dental Engine", "MensHealth Engine", "Little Roots",
  "Content Engine", "Service Engine", "Wellness Engine",
  "Legal AI", "Equipment Rental", "MindStar",
];

const FEATURES = [
  {
    tag: "Multi-tenant",
    tagColor: "bg-blue-50 text-blue-600 border border-blue-100",
    title: "One API key per client. Zero mixing.",
    description: "Each client org gets isolated OAuth tokens, analytics, and API keys. Multi-tenant by design via Clerk orgs — not bolted on.",
    preview: (
      <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-left mt-4">
        <div className="text-gray-500 mb-2">// Each engine calls with its own key</div>
        <div className="text-green-400">POST /api/v1/post</div>
        <div className="text-gray-300 mt-1">{"{"}</div>
        <div className="text-gray-300 ml-4">&quot;profileId&quot;: <span className="text-orange-300">&quot;ak-dental&quot;</span>,</div>
        <div className="text-gray-300 ml-4">&quot;platforms&quot;: <span className="text-blue-300">[&quot;twitter&quot;, &quot;linkedin&quot;]</span>,</div>
        <div className="text-gray-300 ml-4">&quot;post&quot;: <span className="text-orange-300">&quot;Accepting new patients!&quot;</span></div>
        <div className="text-gray-300">{"}"}</div>
      </div>
    ),
  },
  {
    tag: "Scheduled posting",
    tagColor: "bg-purple-50 text-purple-600 border border-purple-100",
    title: "Queue once. Fan out forever.",
    description: "Inngest handles retries, cron jobs, and failures. Schedule posts days in advance. Every platform gets hit at exactly the right time.",
    preview: (
      <div className="bg-gray-50 rounded-xl p-4 mt-4 space-y-2 border border-gray-100">
        {["Twitter ✓ Posted", "LinkedIn ✓ Posted", "Instagram ✓ Posted", "Facebook — Retry 1/3"].map((item, i) => (
          <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${item.includes("Retry") ? "bg-orange-50 text-orange-700 border border-orange-100" : "bg-green-50 text-green-700 border border-green-100"}`}>
            <span>{item}</span>
            <div className={`w-2 h-2 rounded-full ${item.includes("Retry") ? "bg-orange-400" : "bg-green-400"}`} />
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "AI generation",
    tagColor: "bg-pink-50 text-pink-600 border border-pink-100",
    title: "Generate → Approve → Post.",
    description: "Claude generates platform-optimized variants per post. Twitter gets punchy copy, LinkedIn gets professional tone, Instagram gets hashtags. One prompt, nine platforms.",
    preview: (
      <div className="bg-gray-50 rounded-xl p-4 mt-4 space-y-3 border border-gray-100">
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">AI Draft — Pending Approval</div>
        <div className="bg-white rounded-lg p-3 text-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-black rounded-full" />
            <span className="font-medium text-xs text-gray-700">Twitter</span>
          </div>
          <p className="text-gray-600 text-xs">Big news: teeth whitening is 20% off all March 🦷 Book now before spots fill up. #DentalCare #SmileMore</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            <span className="font-medium text-xs text-gray-700">LinkedIn</span>
          </div>
          <p className="text-gray-600 text-xs">We&apos;re excited to announce a special offer for new and returning patients this March: 20% off professional teeth whitening...</p>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 bg-black text-white text-xs py-2 rounded-lg font-medium">Approve &amp; Schedule</button>
          <button className="flex-1 bg-gray-100 text-gray-600 text-xs py-2 rounded-lg font-medium">Edit</button>
        </div>
      </div>
    ),
  },
];

export default function HomeClient() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Announcement bar */}
      <div className="bg-indigo-600 text-white text-sm py-2.5 px-4 text-center">
        <span className="bg-white text-indigo-600 text-xs font-bold px-2 py-0.5 rounded mr-2">NEW</span>
        Fanout replaces Ayrshare — save $599/mo per engine.{" "}
        <Link href="#pricing" className="underline underline-offset-2 font-medium">See pricing →</Link>
      </div>

      {/* Nav */}
      <nav className="border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center">
            <Image src="/fanout-logo.svg" alt="Fanout" width={110} height={30} priority />
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm text-gray-500">
            <Link href="#features" className="hover:text-black transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-black transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-black transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex text-gray-600" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" className="bg-black text-white hover:bg-gray-800 rounded-lg" asChild>
              <Link href="/sign-up">Get started free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — light */}
      <section className="bg-white relative overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Soft indigo glow top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-indigo-100 rounded-full blur-3xl opacity-60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
          <Badge className="mb-6 bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-50 text-xs px-3 py-1">
            Direct Ayrshare alternative · Save $599/mo
          </Badge>

          <h1 className="text-5xl sm:text-7xl font-black text-black mb-6 leading-[1.05] tracking-tight">
            Fan out to the world.
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            One API call posts to 9 platforms on behalf of any client.
            Unlimited profiles, encrypted tokens, built-in AI. Replace Ayrshare in 15 minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Button
              size="lg"
              className="bg-black hover:bg-gray-800 text-white h-12 px-7 text-base rounded-xl font-semibold"
              asChild
            >
              <Link href="/sign-up">
                Get Fanout free <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50 h-12 px-7 text-base rounded-xl"
              asChild
            >
              <Link href="/docs">View API docs</Link>
            </Button>
          </div>

          {/* Product screenshot / dashboard mockup */}
          <div className="relative mx-auto max-w-5xl">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white rounded-md px-4 py-1 text-xs text-gray-400 font-mono border border-gray-200">
                    fanout.digital/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="flex h-[420px]">
                {/* Sidebar */}
                <div className="w-52 border-r border-gray-100 bg-gray-50 p-4 hidden sm:block">
                  <div className="flex items-center mb-6">
                    <Image src="/fanout-logo.svg" alt="Fanout" width={90} height={24} />
                  </div>
                  {["Overview", "Profiles", "Compose", "Schedule", "Analytics", "AI Drafts", "Settings"].map((item, i) => (
                    <div key={item} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg mb-0.5 text-sm cursor-pointer ${i === 0 ? "bg-white text-black font-medium shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-indigo-500" : "bg-gray-300"}`} />
                      {item}
                    </div>
                  ))}

                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-medium">Profiles</div>
                    {["AK Dental", "Little Roots", "MensHealth", "+ Add profile"].map((p, i) => (
                      <div key={p} className={`text-xs px-2 py-1.5 rounded-md mb-0.5 cursor-pointer ${i === 3 ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 p-6 overflow-hidden bg-white">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-black font-semibold text-lg">Overview</h2>
                      <p className="text-gray-400 text-xs mt-0.5">3 active profiles · 9 platforms connected</p>
                    </div>
                    <button className="bg-black text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-gray-800">
                      + Compose
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { label: "Posts today", value: "24" },
                      { label: "Platforms", value: "9" },
                      { label: "Profiles", value: "3" },
                      { label: "Success rate", value: "99.2%" },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                        <div className="text-black font-bold text-lg">{s.value}</div>
                        <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent posts */}
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">Recent posts</div>
                    {[
                      { profile: "AK Dental", platforms: ["twitter", "linkedin", "facebook"], status: "posted", time: "2m ago", content: "Accepting new patients this spring!" },
                      { profile: "Little Roots", platforms: ["instagram", "facebook"], status: "scheduled", time: "in 3h", content: "New haircut specials every Tuesday" },
                      { profile: "MensHealth", platforms: ["twitter", "linkedin"], status: "posted", time: "1h ago", content: "Men's health starts with the right team." },
                    ].map((post) => (
                      <div key={post.content} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${post.status === "posted" ? "bg-green-400" : "bg-yellow-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-black text-xs font-medium">{post.profile}</span>
                            <div className="flex gap-1">
                              {post.platforms.map((p) => (
                                <span key={p} className="text-gray-400 text-xs">{p}</span>
                              ))}
                            </div>
                          </div>
                          <p className="text-gray-400 text-xs truncate mt-0.5">{post.content}</p>
                        </div>
                        <span className="text-gray-400 text-xs shrink-0">{post.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-4 top-16 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg hidden lg:block">
              ✓ Twitter posted
            </div>
            <div className="absolute -right-4 top-24 bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg hidden lg:block">
              ✓ LinkedIn posted
            </div>
            <div className="absolute -right-6 bottom-16 bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg hidden lg:block">
              ✓ Instagram posted
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-10">
          <p className="text-center text-gray-400 text-sm mb-6">
            Powering social distribution for NuStack client engines
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {AGENCIES.map((a) => (
              <span key={a} className="text-gray-400 text-sm font-medium">{a}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-4xl sm:text-5xl font-black text-black mb-4 leading-tight">
              Meet your new social infrastructure.
            </h2>
            <p className="text-lg text-gray-500">
              Fanout handles OAuth, token encryption, scheduling, retries, and AI generation — so your engines just call one endpoint.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-4 ${f.tagColor}`}>
                  {f.tag}
                </span>
                <h3 className="font-bold text-black text-lg mb-2 leading-snug">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
                {f.preview}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform grid */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-400 font-medium uppercase tracking-wider mb-8">
            9 platforms · one integration
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {PLATFORMS.map((p) => (
              <div key={p} className="bg-white rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:border-gray-300 transition-colors">
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black text-black mb-4">
              Simple pricing.
            </h2>
            <p className="text-lg text-gray-500">14-day free trial. No credit card required.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Starter",
                price: "$49",
                desc: "For small agencies",
                items: ["3 client profiles", "5 platforms", "Scheduled posting", "API access"],
                cta: "Start free",
                highlight: false,
              },
              {
                name: "Agency",
                price: "$199",
                desc: "Most popular",
                items: ["25 client profiles", "All 9 platforms", "AI content generation", "Analytics dashboard", "Webhooks per profile"],
                cta: "Start free",
                highlight: true,
              },
              {
                name: "White-Label",
                price: "$399",
                desc: "Unlimited everything",
                items: ["Unlimited profiles", "All 9 platforms", "Custom domain", "White-label dashboard", "Dedicated support"],
                cta: "Contact us",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col border ${plan.highlight ? "bg-black text-white border-black shadow-xl" : "bg-white text-black border-gray-200"}`}
              >
                {plan.highlight && (
                  <Badge className="self-start mb-4 bg-indigo-600 text-white border-0 text-xs">Most popular</Badge>
                )}
                <div className="mb-6">
                  <h3 className={`font-bold text-lg mb-1 ${plan.highlight ? "text-white" : "text-black"}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${plan.highlight ? "text-gray-400" : "text-gray-500"}`}>{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-5xl font-black ${plan.highlight ? "text-white" : "text-black"}`}>{plan.price}</span>
                    <span className={plan.highlight ? "text-gray-400" : "text-gray-500"}>/mo</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.items.map((item) => (
                    <li key={item} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-gray-300" : "text-gray-600"}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${plan.highlight ? "bg-indigo-600" : "bg-gray-100 border border-gray-200"}`}>
                        <svg className={`w-2.5 h-2.5 ${plan.highlight ? "text-white" : "text-gray-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full rounded-xl font-semibold ${plan.highlight ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-black text-white hover:bg-gray-800"}`}
                  asChild
                >
                  <Link href={plan.name === "White-Label" ? "mailto:brad@nustack.digital" : "/sign-up"}>
                    {plan.cta}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ayrshare Comparison Table */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-red-50 text-red-600 border border-red-100 hover:bg-red-50 text-xs px-3 py-1">
              Why teams switch from Ayrshare
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-black mb-4 leading-tight">
              Fanout vs Ayrshare
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Same idea. Better execution. At a fraction of the price.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
              <div className="p-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Feature</div>
              <div className="p-4 text-center border-l border-gray-200">
                <span className="text-sm font-bold text-black">Fanout</span>
                <div className="text-xs text-indigo-600 font-medium mt-0.5">From $49/mo</div>
              </div>
              <div className="p-4 text-center border-l border-gray-200">
                <span className="text-sm font-semibold text-gray-500">Ayrshare</span>
                <div className="text-xs text-gray-400 mt-0.5">From $648/mo</div>
              </div>
            </div>

            {/* Rows */}
            {[
              { feature: "Starting price", fanout: "$49/mo", ayrshare: "$648/mo", win: true },
              { feature: "Client profiles", fanout: "Unlimited (White-Label)", ayrshare: "3 on $648 plan", win: true },
              { feature: "Platforms", fanout: "9 platforms", ayrshare: "9 platforms", win: false },
              { feature: "Token ownership", fanout: "You own + encrypt tokens", ayrshare: "Ayrshare holds tokens", win: true },
              { feature: "AI content generation", fanout: "Built-in (Claude)", ayrshare: "Add-on, extra cost", win: true },
              { feature: "Multi-tenant / White-label", fanout: "Native (Clerk orgs)", ayrshare: "Enterprise only", win: true },
              { feature: "API-first", fanout: "Full REST API + webhooks", ayrshare: "API available", win: false },
              { feature: "Self-hosted option", fanout: "Open architecture", ayrshare: "SaaS only", win: true },
            ].map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
              >
                <div className="p-4 text-sm text-gray-700 font-medium flex items-center">{row.feature}</div>
                <div className={`p-4 text-center border-l border-gray-100 flex items-center justify-center ${row.win ? "bg-indigo-50/50" : ""}`}>
                  <span className={`text-sm font-semibold ${row.win ? "text-indigo-700" : "text-gray-700"}`}>
                    {row.win && <span className="mr-1.5">✓</span>}{row.fanout}
                  </span>
                </div>
                <div className="p-4 text-center border-l border-gray-100 flex items-center justify-center">
                  <span className={`text-sm ${row.win ? "text-gray-400" : "text-gray-700 font-medium"}`}>{row.ayrshare}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-400 text-xs mt-4">
            Ayrshare pricing as of 2026. Fanout pricing subject to change.
          </p>
        </div>
      </section>

      {/* Final CTA — light version */}
      <section className="py-24 bg-white border-t border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-indigo-50 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-6xl font-black text-black mb-4 leading-tight">
            Replace Ayrshare<br />in 15 minutes.
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            One env var swap. Every engine. Every client. Forever.
          </p>
          <Button
            size="lg"
            className="bg-black hover:bg-gray-800 text-white h-12 px-8 text-base rounded-xl font-semibold"
            asChild
          >
            <Link href="/sign-up">
              Get Fanout free <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/fanout-logo.svg" alt="Fanout" width={90} height={24} />
            <span className="text-gray-300 text-sm">· by NuStack Digital Ventures</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/docs" className="hover:text-black transition-colors">Docs</Link>
            <Link href="#pricing" className="hover:text-black transition-colors">Pricing</Link>
            <Link href="/sign-in" className="hover:text-black transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
