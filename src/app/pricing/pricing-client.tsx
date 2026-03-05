"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    planKey: "starter",
    monthlyPrice: 49,
    yearlyPrice: 39,
    description: "Perfect for freelancers managing a handful of clients.",
    features: [
      "3 client profiles",
      "1,000 posts/mo",
      "All 9 platforms",
      "API access",
      "Dashboard access",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Agency",
    planKey: "agency",
    monthlyPrice: 199,
    yearlyPrice: 159,
    description: "For agencies running multiple client accounts at scale.",
    features: [
      "25 client profiles",
      "10,000 posts/mo",
      "All 9 platforms",
      "AI content generation",
      "Analytics dashboard",
      "Per-profile webhooks",
      "Scheduled posting",
      "API access",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "White-Label",
    planKey: "white-label",
    monthlyPrice: 399,
    yearlyPrice: 319,
    description: "Full white-label rights with your brand, your domain.",
    features: [
      "Unlimited client profiles",
      "Unlimited posts",
      "All 9 platforms",
      "AI content generation",
      "Analytics dashboard",
      "Per-profile webhooks",
      "Custom domain",
      "White-label dashboard",
      "Dedicated support",
      "Custom onboarding",
    ],
    highlighted: false,
  },
];

const FAQS = [
  {
    q: "How is Fanout different from Ayrshare?",
    a: "Fanout is built for agencies that also build SaaS. You get the same 9-platform coverage as Ayrshare — but with full white-label rights, token ownership, and AI content generation included on all plans. Starting at $49/mo vs Ayrshare's $648/mo.",
  },
  {
    q: "Do I need to verify my apps with each platform?",
    a: "No. Fanout manages the OAuth app credentials. You simply authorize your client accounts through our connect flow and we handle token management, refreshes, and retries automatically.",
  },
  {
    q: "Can I post videos and images?",
    a: "Yes. Pass mediaUrls in your post request. Fanout handles upload to each platform's media API. Supported formats vary by platform (e.g. MP4 for TikTok/YouTube, JPG/PNG for Instagram/Pinterest).",
  },
  {
    q: "What happens if a post fails?",
    a: "Inngest automatically retries failed platform posts up to 3 times with exponential backoff. You'll receive an email notification and see per-platform failure status in the dashboard. You can retry from the compose screen.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — every plan includes a 14-day free trial. No credit card required. You get 1 profile and full API access to evaluate before committing.",
  },
];

export function PricingPlans() {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      {/* Annual toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!yearly ? "text-black" : "text-gray-400"}`}>Monthly</span>
        <button
          onClick={() => setYearly(!yearly)}
          className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? "bg-black" : "bg-gray-200"}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              yearly ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${yearly ? "text-black" : "text-gray-400"}`}>
          Yearly
          <Badge className="ml-2 bg-green-100 text-green-700 border-green-200 text-xs" variant="outline">
            Save 20%
          </Badge>
        </span>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <Card
              key={plan.name}
              className={`p-6 flex flex-col ${
                plan.highlighted ? "border-black ring-1 ring-black" : "border-gray-100"
              }`}
            >
              {plan.highlighted && (
                <Badge className="bg-black text-white self-start mb-3 text-xs">Most popular</Badge>
              )}
              <h2 className="text-xl font-bold text-black">{plan.name}</h2>
              <div className="mt-2 mb-1">
                <span className="text-4xl font-black text-black">${price}</span>
                <span className="text-gray-500 text-sm">/mo</span>
                {yearly && (
                  <span className="text-xs text-gray-400 ml-2">billed annually</span>
                )}
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
                <Link href={`/sign-up?plan=${plan.planKey}`}>Get started →</Link>
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function PricingFAQ() {
  return (
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
  );
}
