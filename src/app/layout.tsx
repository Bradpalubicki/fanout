import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import JsonLd from "@/components/seo/JsonLd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fanout.digital"),
  title: {
    template: "%s | Fanout",
    default: "Fanout — Social Media API & Automation Platform",
  },
  description:
    "Post to Twitter, LinkedIn, Instagram, TikTok, YouTube, Reddit & more with one API call. The Ayrshare alternative built for developers. Free 14-day trial.",
  keywords: [
    "social media api",
    "ayrshare alternative",
    "social media automation",
    "post to multiple platforms",
    "social media scheduling api",
    "agency social posting",
    "multi-platform social media",
    "social media developer api",
  ],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: "https://fanout.digital",
    siteName: "Fanout",
    title: "Fanout — Social Media API & Automation Platform",
    description:
      "Post to Twitter, LinkedIn, Instagram, TikTok, YouTube, Reddit & more with one API call. The Ayrshare alternative built for developers.",
    images: [
      {
        url: "https://fanout.digital/og",
        width: 1200,
        height: 630,
        alt: "Fanout — Social Media API & Automation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fanout — Social Media API & Automation Platform",
    description:
      "Post to 9 platforms with one API call. The Ayrshare alternative built for developers. Free 14-day trial.",
    images: ["https://fanout.digital/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://fanout.digital",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "msvalidate.01": "F5BE8B522A66B1E13B5E59322FB38C2F",
    },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://fanout.digital/#organization",
      name: "Fanout",
      url: "https://fanout.digital",
      logo: "https://fanout.digital/fanout-logo-dark.svg",
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": "https://fanout.digital/#website",
      url: "https://fanout.digital",
      name: "Fanout",
      publisher: { "@id": "https://fanout.digital/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://fanout.digital/docs?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "Fanout",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "49",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Agency",
          price: "199",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "White-Label",
          price: "399",
          priceCurrency: "USD",
        },
      ],
      description:
        "Social media automation API that posts to 9 platforms simultaneously",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link rel="preconnect" href="https://us.i.posthog.com" />
        </head>
        <body className={`${geistSans.variable} antialiased`}>
          <JsonLd data={organizationJsonLd} />
          {children}
          <Toaster />
          {gaMeasurementId && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
                strategy="afterInteractive"
              />
              <Script id="ga4-init" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaMeasurementId}');
                `}
              </Script>
            </>
          )}
        </body>
      </html>
    </ClerkProvider>
  );
}
