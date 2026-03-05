import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";
import { DocsClient } from "./docs-client";

export const metadata: Metadata = {
  title: "API Docs | Fanout",
  description:
    "Complete API reference for posting to 9 social platforms with one API call.",
  alternates: {
    canonical: "https://fanout.digital/docs",
  },
  openGraph: {
    title: "API Docs | Fanout",
    description:
      "Complete API reference for posting to 9 social platforms with one API call.",
    url: "https://fanout.digital/docs",
  },
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 sticky top-0 bg-gray-950/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-bold text-lg text-white">Fanout</span>
            <span className="text-gray-500 text-sm ml-1">/ Docs</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sign-up" className="text-sm bg-white text-black px-4 py-1.5 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              Get API Key
            </Link>
          </div>
        </div>
      </nav>

      <DocsClient />
    </div>
  );
}
