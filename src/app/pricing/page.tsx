import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Zap } from "lucide-react";
import type { Metadata } from "next";

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

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    description: "Perfect for freelancers managing a handful of clients.",
    profiles: 3,
    platforms: 5,
    highlighted: false,
    features: [
      "3 client profiles",
      "5 social platforms",
      "Scheduled posting",
      "API access",
      "Dashboard access",
      "Email support",
    ],
  },
  {
    name: "Agency",
    price: "$199",
    description: "For agencies running multiple client accounts at scale.",
    profiles: 25,
    platforms: 9,
    highlighted: true,
    features: [
      "25 client profiles",
      "All 9 platforms",
      "AI content generation",
      "Analytics dashboard",
      "Per-profile webhooks",
      "Scheduled posting",
      "API access",
      "Priority support",
    ],
  },
  {
    name: "White-Label",
    price: "$399",
    description: "Full white-label rights with your brand, your domain.",
    profiles: -1,
    platforms: 9,
    highlighted: false,
    features: [
      "Unlimited client profiles",
      "All 9 platforms",
      "AI content generation",
      "Analytics dashboard",
      "Per-profile webhooks",
      "Custom domain",
      "White-label dashboard",
      "Dedicated support",
      "Custom onboarding",
    ],
  },
];

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

const FAQS = [
  {
    q: "What counts as a client profile?",
    a: "A profile represents one client brand or account. Each profile has its own isolated OAuth tokens, API key, analytics, and webhook URL. You can post to multiple platforms from a single profile.",
  },
  {
    q: "Can I switch plans at any time?",
    a: "Yes — upgrade or downgrade anytime. Upgrades take effect immediately. Downgrades take effect at your next billing cycle.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every plan comes with a 14-day free trial. No credit card required to start.",
  },
  {
    q: "Do I need to register OAuth apps with each platform?",
    a: "No. Fanout handles the OAuth app credentials. You simply authorize your client accounts through our flow and we handle the token management, refreshes, and retries.",
  },
  {
    q: "What happens if a post fails on one platform?",
    a: "Inngest automatically retries failed platform posts up to 3 times with exponential backoff. You'll see the failure status per-platform in the dashboard and receive a webhook callback if configured.",
  },
  {
    q: "Can I use the API without the dashboard?",
    a: "Yes. Every plan includes full API access. You can post entirely via API without ever opening the dashboard — ideal for programmatic use from other engines.",
  },
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

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 flex flex-col ${
                plan.highlighted
                  ? "border-black ring-1 ring-black"
                  : "border-gray-100"
              }`}
            >
              {plan.highlighted && (
                <Badge className="bg-black text-white self-start mb-3 text-xs">Most popular</Badge>
              )}
              <h2 className="text-xl font-bold text-black">{plan.name}</h2>
              <div className="mt-2 mb-1">
                <span className="text-4xl font-black text-black">{plan.price}</span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              <p className="text-gray-500 text-sm mb-6">{plan.description}</p>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  plan.highlighted
                    ? "bg-black text-white hover:bg-gray-800"
                    : "border border-gray-200 text-black hover:bg-gray-50"
                }`}
                variant={plan.highlighted ? "default" : "outline"}
                asChild
              >
                <Link href="/sign-up">Start free trial</Link>
              </Button>
            </Card>
          ))}
        </div>

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
        <div className="mb-16">
          <h2 className="text-2xl font-black text-black mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-6 max-w-2xl mx-auto">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="font-semibold text-black mb-2">{faq.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

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
