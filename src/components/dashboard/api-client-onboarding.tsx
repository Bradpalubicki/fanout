"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  Copy,
  Check,
  Key,
  Webhook,
  UserCircle,
  AppWindow,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface APIClientOnboardingProps {
  prefill?: {
    business_name?: string;
    website?: string;
    industry?: string;
    client_type?: string;
  } | null;
}

interface CopyButtonProps {
  text: string;
  label?: string;
}

function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors px-2 py-1 rounded hover:bg-gray-100"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative bg-gray-950 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <CopyButton text={code} />
      </div>
      <pre className="px-4 py-3 text-xs text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

const STEPS = [
  { id: "api-key", icon: Key, label: "API Key" },
  { id: "webhook", icon: Webhook, label: "Webhook Setup" },
  { id: "profile", icon: UserCircle, label: "First Profile" },
  { id: "apps", icon: AppWindow, label: "Developer Apps" },
];

export function APIClientOnboarding({ prefill }: APIClientOnboardingProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [apiKey, setApiKey] = useState<string>("");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Load API key from dashboard data (profiles)
  useEffect(() => {
    async function fetchApiKey() {
      try {
        const res = await fetch("/api/v1/profiles?limit=1");
        if (!res.ok) return;
        const data = (await res.json()) as { profiles?: Array<{ api_key?: string }> };
        const key = data.profiles?.[0]?.api_key;
        if (key) setApiKey(key);
      } catch {
        // Key will show as placeholder
      }
    }
    void fetchApiKey();
  }, []);

  const displayKey = apiKey || "YOUR_API_KEY";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanout.digital";
  const webhookUrl = `${appUrl}/api/webhooks/inbound`;

  const curlExample = `curl -X POST ${appUrl}/api/v1/posts \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Hello from the Fanout API!",
    "platforms": ["twitter", "linkedin"]
  }'`;

  const fetchExample = `const res = await fetch("${appUrl}/api/v1/posts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${displayKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    content: "Hello from the Fanout API!",
    platforms: ["twitter", "linkedin"],
  }),
});
const data = await res.json();
console.log(data); // { post_id: "...", status: "pending" }`;

  const webhookSetupExample = `// Receive Fanout webhook events
app.post("/fanout-webhook", (req, res) => {
  const event = req.body;
  // event.type: "post.published" | "post.failed" | "token.expired"
  console.log("Fanout event:", event.type, event.data);
  res.sendStatus(200);
});`;

  function markComplete(stepIndex: number) {
    setCompletedSteps((prev) => new Set([...prev, stepIndex]));
    if (stepIndex < STEPS.length - 1) {
      setActiveStep(stepIndex + 1);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Business context banner */}
      {prefill?.business_name && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm text-indigo-800">
          Setting up API access for <strong>{prefill.business_name}</strong>
          {prefill.industry && ` · ${prefill.industry}`}
        </div>
      )}

      {/* Step tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === i;
          const isDone = completedSteps.has(i);
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(i)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? "bg-white text-black shadow-sm"
                  : isDone
                  ? "text-green-600 hover:bg-white/50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <Card className="border-gray-100 shadow-sm overflow-hidden">
        {/* Step 1 — API Key */}
        {activeStep === 0 && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-black text-base">Your API Key</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  This key authenticates every API request. Keep it secret — treat it like a password.
                </p>
              </div>
            </div>

            <div className="bg-gray-950 rounded-lg p-4 flex items-center justify-between gap-3">
              <code className="text-green-400 font-mono text-sm break-all">
                {displayKey}
              </code>
              <CopyButton text={displayKey} label="Copy Key" />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-800">
              Never expose this key in client-side code or public repositories. Use environment variables.
            </div>

            <Button
              className="w-full bg-black text-white hover:bg-gray-800 gap-2"
              onClick={() => markComplete(0)}
            >
              I&apos;ve saved my API key <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 2 — Webhook Setup */}
        {activeStep === 1 && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
                <Webhook className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-black text-base">Webhook Setup</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Fanout sends events to your server when posts are published, fail, or when tokens expire.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Set your webhook endpoint in Settings
              </p>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <code className="text-sm text-gray-700 flex-1 font-mono">{webhookUrl}</code>
                <CopyButton text={webhookUrl} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Example handler (Express / Next.js)
              </p>
              <CodeBlock code={webhookSetupExample} language="javascript" />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                asChild
              >
                <Link href="/dashboard/settings#webhooks">
                  Configure Webhook
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button
                className="flex-1 bg-black text-white hover:bg-gray-800 gap-2"
                onClick={() => markComplete(1)}
              >
                Next step <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — First Profile */}
        {activeStep === 2 && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
                <UserCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-black text-base">Create Your First Profile</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  A profile groups your social accounts together. Each API post targets a specific profile.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Quick-post example (after connecting a platform)
              </p>
              <CodeBlock code={curlExample} language="curl" />
              <CodeBlock code={fetchExample} language="javascript" />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/dashboard/setup">
                  Use Setup Agent
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button
                className="flex-1 bg-black text-white hover:bg-gray-800 gap-2"
                onClick={() => markComplete(2)}
              >
                Next step <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Developer Apps */}
        {activeStep === 3 && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <AppWindow className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-black text-base">Developer Apps</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Create named API applications with scoped keys — useful for multiple projects or team members.
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-800 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">You&apos;re all set!</p>
                <p className="text-xs mt-1 text-green-700">
                  Your API key is active and your webhook is ready to receive events. Head to Developer Apps to manage additional keys.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/dashboard/developer-apps">
                  <AppWindow className="w-4 h-4 mr-2" />
                  Developer Apps
                </Link>
              </Button>
              <Button
                className="flex-1 bg-black text-white hover:bg-gray-800 gap-2"
                onClick={() => markComplete(3)}
                asChild
              >
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveStep(i)}
            className={`rounded-full transition-all ${
              i === activeStep
                ? "w-6 h-2 bg-black"
                : completedSteps.has(i)
                ? "w-2 h-2 bg-green-500"
                : "w-2 h-2 bg-gray-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
