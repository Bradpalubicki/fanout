"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import {
  Plug,
  Bot,
  Code2,
  ArrowRight,
  Building2,
} from "lucide-react";
import { APIClientOnboarding } from "@/components/dashboard/api-client-onboarding";

function EntryContent() {
  const searchParams = useSearchParams();
  const prefillRaw = searchParams.get("prefill");
  const mode = searchParams.get("mode");

  type PrefillData = {
    business_name?: string;
    website?: string;
    industry?: string;
    client_type?: string;
  };

  let prefill: PrefillData | null = null;

  if (prefillRaw) {
    try {
      prefill = JSON.parse(decodeURIComponent(prefillRaw)) as PrefillData;
    } catch {
      // ignore malformed prefill
    }
  }

  // API clients → developer wizard
  if (mode === "api" || prefill?.client_type === "api") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-black text-lg">Fanout Developer Setup</span>
          </div>
        </div>
        <div className="flex-1 px-6 py-8">
          <APIClientOnboarding prefill={prefill} />
        </div>
      </div>
    );
  }

  const hasPrefill = !!(prefill?.business_name || prefill?.website || prefill?.industry);

  // Consumer path — binary choice
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-lg">F</span>
          </div>
          <h1 className="text-2xl font-bold text-black mb-2">Welcome to Fanout</h1>
          <p className="text-gray-500 text-sm">
            {hasPrefill && prefill?.business_name
              ? `Let's get ${prefill.business_name} set up for social media.`
              : "Let's get you posting to all your platforms in minutes."}
          </p>
        </div>

        {/* Pre-fill banner */}
        {hasPrefill && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold text-indigo-900">Your info is pre-filled</span>
              <p className="text-indigo-700 text-xs mt-0.5">
                {[
                  prefill?.business_name,
                  prefill?.industry,
                  prefill?.website,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        )}

        {/* Choice cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Card A — I already have accounts */}
          <Link
            href={`/dashboard/setup/connect${prefillRaw ? `?prefill=${prefillRaw}` : ""}`}
            className="group bg-white border border-gray-200 hover:border-black rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-md"
          >
            <div className="w-10 h-10 bg-gray-50 group-hover:bg-black rounded-xl flex items-center justify-center transition-colors">
              <Plug className="w-5 h-5 text-gray-700 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h2 className="font-bold text-black text-base mb-1">
                I already have social accounts
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Connect your existing Twitter, LinkedIn, Instagram, and more. Takes 2–5 minutes.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-black mt-auto">
              Connect platforms <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Card B — Help me build my presence */}
          <Link
            href={`/dashboard/setup${prefillRaw ? `?prefill=${prefillRaw}` : ""}`}
            className="group bg-white border border-gray-200 hover:border-indigo-500 rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-md"
          >
            <div className="w-10 h-10 bg-indigo-50 group-hover:bg-indigo-600 rounded-xl flex items-center justify-center transition-colors">
              <Bot className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <div>
              <h2 className="font-bold text-black text-base mb-1">
                Help me build my presence
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Tell our AI agent about your business and it will configure everything — profiles, tone, schedule, and seed posts.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 mt-auto">
              Start with AI Setup <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          You can change any of this later from your dashboard.
        </p>
      </div>
    </div>
  );
}

export default function SetupEntryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <EntryContent />
    </Suspense>
  );
}
