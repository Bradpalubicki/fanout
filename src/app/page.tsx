import type { Metadata } from "next";
import JsonLd from "@/components/seo/JsonLd";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Fanout — Social Media API: Post to 9 Platforms at Once",
  description:
    "Fanout is the Ayrshare alternative built for developers. One API call posts to Twitter, LinkedIn, Instagram, TikTok, YouTube, Reddit, and more. Free 14-day trial.",
  alternates: {
    canonical: "https://fanout.digital",
  },
  openGraph: {
    title: "Fanout — Social Media API: Post to 9 Platforms at Once",
    description:
      "One API call posts to Twitter, LinkedIn, Instagram, TikTok, YouTube, Reddit, and more. The Ayrshare alternative built for developers.",
    url: "https://fanout.digital",
  },
  twitter: {
    title: "Fanout — Social Media API: Post to 9 Platforms at Once",
    description:
      "One API call posts to Twitter, LinkedIn, Instagram, TikTok, YouTube, Reddit, and more.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Fanout?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fanout is a social media API and automation platform that lets you post to Twitter/X, LinkedIn, Instagram, Facebook, TikTok, YouTube, Pinterest, Reddit, and Threads with a single API call.",
      },
    },
    {
      "@type": "Question",
      name: "How does Fanout compare to Ayrshare?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fanout is a direct Ayrshare alternative. Ayrshare starts at $149/month with limited profiles. Fanout starts at $49/month, includes AI content generation on Agency plans, gives you full OAuth token ownership, and is natively multi-tenant — meaning each client gets isolated credentials and analytics without extra configuration.",
      },
    },
    {
      "@type": "Question",
      name: "How does Fanout compare to LATE (getlate.dev)?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LATE is a developer API starting at $19/month, well-suited for single-account integrations. Fanout is purpose-built for agencies managing multiple clients: per-client profile isolation via Clerk orgs, per-profile API keys, built-in Claude AI content generation, white-label dashboard rights, and Inngest-powered retry logic. If you manage one account, LATE works. If you manage multiple client brands, Fanout is the right tool.",
      },
    },
    {
      "@type": "Question",
      name: "What platforms does Fanout support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fanout supports 9 platforms: Twitter/X, LinkedIn, Facebook, Instagram, TikTok, YouTube, Pinterest, Reddit, and Threads.",
      },
    },
    {
      "@type": "Question",
      name: "Does Fanout have a free trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Fanout offers a 14-day free trial with no credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "What is a social media API?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A social media API lets developers programmatically publish content to social networks. Instead of logging into each platform manually, you send one API request and Fanout distributes it to all your connected platforms automatically.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <HomeClient />
    </>
  );
}
