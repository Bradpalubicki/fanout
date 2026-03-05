import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import type { Metadata } from "next";
import { PricingPlans, PricingFAQ } from "./pricing-client";

export const metadata: Metadata = {
  title: "Pricing — Fanout Social Media API",
  description:
    "Fanout pricing starts at $49/month. Starter, Agency ($199), and White-Label ($399) plans. All plans include API access and scheduled posting. 14-day free trial, no credit card required.",
  alternates: {
    canonical: "https://fanout.digital/pricing",
  },
  openGraph: {
    title: "Pricing — Fanout Social Media API",
    description:
      "Plans from $49/month. Post to 9 platforms with one API call. 14-day free trial, no credit card required.",
    url: "https://fanout.digital/pricing",
  },
  twitter: {
    title: "Pricing — Fanout Social Media API",
    description:
      "Plans from $49/month. Post to 9 social platforms with one API call.",
  },
};

const COMPARISON = [
  { feature: "Client profiles", starter: "3", agency: "25", whitelabel: "Unlimited" },
  { feature: "Social platforms", starter: "5", agency: "9 (all)", whitelabel: "9 (all)" },
  { feature: "API access", starter: "✓", agency: "✓", whitelabel: "✓" },
  { feature: "Scheduled posting", starter: "✓", agency: "✓", whitelabel: "✓" },
  { feature: "AI content generation", starter: "—", agency: "✓", whitelabel: "✓" },
  { feature: "Analytics dashboard", starter: "—", agency: "✓", whitelabel: "✓" },
  { feature: "Per-profile webhooks", starter: "—", agency: "✓", whitelabel: "✓" },
  { feature: "White-label", starter: "—", agency: "—", whitelabel: "✓" },
  { feature: "Custom domain", starter: "—", agency: "—", whitelabel: "✓" },
  { feature: "Support", starter: "Email", agency: "Priority", whitelabel: "Dedicated" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-base">Fanout</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm text-gray-600 hover:text-black">Docs</Link>
            <Button size="sm" className="bg-black text-white hover:bg-gray-800" asChild>
              <Link href="/sign-up">Start free trial</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center py-16 px-4">
        <h1 className="text-4xl font-black text-black mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto">
          14-day free trial. No credit card required. Cancel anytime.
        </p>
      </div>

      {/* Plans with annual toggle */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <PricingPlans />

        {/* Feature comparison table */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-black mb-6 text-center">Feature comparison</h2>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100 text-sm font-semibold">
              <div className="p-4 text-gray-600">Feature</div>
              <div className="p-4 text-center text-black">Starter</div>
              <div className="p-4 text-center text-black bg-gray-100">Agency</div>
              <div className="p-4 text-center text-black">White-Label</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 text-sm border-b border-gray-50 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                }`}
              >
                <div className="p-4 text-gray-600">{row.feature}</div>
                <div className="p-4 text-center text-gray-700">{row.starter}</div>
                <div className="p-4 text-center text-gray-700 bg-gray-50/50">{row.agency}</div>
                <div className="p-4 text-center text-gray-700">{row.whitelabel}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <PricingFAQ />

        {/* CTA Banner */}
        <div className="bg-black rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Ready to fan out?</h2>
          <p className="text-gray-400 mb-6">Start your free 14-day trial. No credit card required.</p>
          <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-bold" asChild>
            <Link href="/sign-up">Start free today →</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
