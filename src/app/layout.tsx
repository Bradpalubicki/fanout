import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  title: "Fanout — One post. Every platform.",
  description:
    "The social API built for agencies. Post to 9 platforms, unlimited clients, zero per-profile fees. Replace Ayrshare in 15 minutes.",
  keywords: ["social media api", "ayrshare alternative", "social media automation", "agency social posting"],
  openGraph: {
    title: "Fanout — One post. Every platform.",
    description: "The social API built for agencies. Post to 9 platforms, unlimited clients, zero per-profile fees.",
    url: "https://fanout.digital",
    siteName: "Fanout",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fanout — One post. Every platform.",
    description: "The social API built for agencies.",
  },
  metadataBase: new URL("https://fanout.digital"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} antialiased`}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
