"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { id: "quickstart", label: "Quick Start" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoints", label: "Endpoints" },
  { id: "examples", label: "Code Examples" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "webhooks", label: "Webhooks" },
];

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-black border border-gray-800 rounded-xl p-4 text-sm overflow-x-auto text-gray-300 font-mono leading-relaxed">
        <code className={`language-${lang}`}>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 text-xs text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function EndpointBlock({
  method,
  path,
  description,
  request,
  response,
}: {
  method: string;
  path: string;
  description: string;
  request?: string;
  response: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-900 text-blue-300 border border-blue-800",
    POST: "bg-green-900 text-green-300 border border-green-800",
    DELETE: "bg-red-900 text-red-300 border border-red-800",
  };

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden mb-6">
      <div className="flex items-center gap-3 p-4 bg-gray-900 border-b border-gray-800">
        <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${methodColors[method] ?? "bg-gray-700 text-gray-300"}`}>
          {method}
        </span>
        <code className="font-mono text-sm font-semibold text-green-400">{path}</code>
        <span className="ml-auto text-xs text-gray-500">Auth required</span>
      </div>
      <div className="p-4 bg-gray-950">
        <p className="text-gray-400 text-sm mb-4">{description}</p>
        {request && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Request body</p>
            <CodeBlock code={request} lang="json" />
            <div className="mb-4" />
          </>
        )}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Response</p>
        <CodeBlock code={response} lang="json" />
      </div>
    </div>
  );
}

const CODE_EXAMPLES = {
  curl: `curl -X POST https://fanout.digital/api/v1/post \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Hello from Fanout!",
    "platforms": ["twitter", "linkedin", "instagram"],
    "profileId": "your-profile-uuid"
  }'`,
  node: `import fetch from 'node-fetch'

const response = await fetch('https://fanout.digital/api/v1/post', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: 'Hello from Fanout!',
    platforms: ['twitter', 'linkedin', 'instagram'],
    profileId: 'your-profile-uuid',
  }),
})

const data = await response.json()
console.log(data.postId) // "abc-123..."`,
  python: `import requests

response = requests.post(
    'https://fanout.digital/api/v1/post',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'content': 'Hello from Fanout!',
        'platforms': ['twitter', 'linkedin', 'instagram'],
        'profileId': 'your-profile-uuid',
    }
)

data = response.json()
print(data['postId'])  # "abc-123..."`,
};

export function DocsClient() {
  const [activeSection, setActiveSection] = useState("quickstart");
  const [activeTab, setActiveTab] = useState<"curl" | "node" | "python">("curl");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:block w-52 shrink-0">
        <nav className="sticky top-20 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
            Contents
          </p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? "bg-gray-800 text-white font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white text-black rounded-full p-3 shadow-lg font-medium text-sm"
        >
          Contents
        </button>
        {sidebarOpen && (
          <div className="absolute bottom-12 right-0 bg-gray-900 border border-gray-700 rounded-xl p-3 w-48 shadow-xl">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 max-w-3xl">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl font-black text-white mb-3">
            The Social Media Posting API
          </h1>
          <p className="text-xl text-gray-400">
            One API call. Nine platforms. Zero headaches.
          </p>
        </div>

        {/* Quick Start */}
        <section id="quickstart" className="mb-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Base URL</p>
            <code className="text-green-400 font-mono text-sm">https://fanout.digital/api/v1</code>
          </div>
          <p className="text-gray-400 text-sm">
            Get your API key from{" "}
            <Link href="/dashboard" className="text-white underline underline-offset-2">
              Dashboard → Profiles → [Profile] → API Key
            </Link>
            . One key per profile. Rate-limited per profile.
          </p>
        </section>

        {/* Authentication */}
        <section id="authentication" className="mb-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-white mb-4">Authentication</h2>
          <p className="text-gray-400 text-sm mb-4">
            All API requests require a Bearer token in the Authorization header.
          </p>
          <CodeBlock code={`Authorization: Bearer YOUR_API_KEY`} lang="http" />
          <div className="mt-4">
            <CodeBlock
              code={`curl https://fanout.digital/api/v1/platforms \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
            />
          </div>
        </section>

        {/* Endpoints */}
        <section id="endpoints" className="mb-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-white mb-6">Endpoints</h2>

          <EndpointBlock
            method="POST"
            path="/api/v1/post"
            description="Post content to one or more platforms immediately."
            request={`{
  "content": "Your post content here",
  "platforms": ["twitter", "linkedin", "instagram"],
  "mediaUrls": ["https://example.com/image.jpg"],
  "profileId": "your-profile-uuid"
}`}
            response={`{
  "postId": "a1b2c3d4-...",
  "results": [
    { "platform": "twitter", "status": "success", "postUrl": "https://twitter.com/..." },
    { "platform": "linkedin", "status": "success", "postUrl": "https://linkedin.com/..." },
    { "platform": "instagram", "status": "queued", "postUrl": null }
  ]
}`}
          />

          <EndpointBlock
            method="POST"
            path="/api/v1/schedule"
            description="Schedule a post to be published at a future time (ISO 8601)."
            request={`{
  "content": "Your scheduled post",
  "platforms": ["twitter", "linkedin"],
  "scheduledAt": "2026-04-01T10:00:00Z",
  "profileId": "your-profile-uuid"
}`}
            response={`{
  "postId": "a1b2c3d4-...",
  "scheduledAt": "2026-04-01T10:00:00Z"
}`}
          />

          <EndpointBlock
            method="GET"
            path="/api/v1/platforms"
            description="Get all connected platforms for the authenticated profile."
            response={`{
  "platforms": [
    {
      "platform": "twitter",
      "connected": true,
      "username": "youraccount",
      "expiresAt": "2026-06-01T00:00:00Z"
    },
    {
      "platform": "linkedin",
      "connected": true,
      "username": "Your Name",
      "expiresAt": null
    }
  ]
}`}
          />

          <EndpointBlock
            method="GET"
            path="/api/v1/analytics/:postId"
            description="Retrieve engagement analytics for a specific post across all platforms."
            response={`{
  "postId": "a1b2c3d4-...",
  "results": [
    {
      "platform": "twitter",
      "likes": 42,
      "shares": 8,
      "comments": 3,
      "impressions": 1240
    },
    {
      "platform": "linkedin",
      "likes": 15,
      "shares": 2,
      "comments": 1,
      "impressions": 890
    }
  ]
}`}
          />
        </section>

        {/* Code Examples */}
        <section id="examples" className="mb-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-white mb-4">Code Examples</h2>
          <p className="text-gray-400 text-sm mb-4">
            Post to multiple platforms with a single request.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
            {(["curl", "node", "python"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab === "curl" ? "cURL" : tab === "node" ? "Node.js" : "Python"}
              </button>
            ))}
          </div>

          <CodeBlock
            code={CODE_EXAMPLES[activeTab]}
            lang={activeTab === "python" ? "python" : activeTab === "node" ? "javascript" : "bash"}
          />
        </section>

        {/* Rate Limits */}
        <section id="rate-limits" className="mb-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-white mb-4">Rate Limits</h2>
          <p className="text-gray-400 text-sm mb-6">
            Rate limits are applied per API key (per profile). Limits reset monthly.
          </p>

          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 bg-gray-900 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <div className="p-4">Plan</div>
              <div className="p-4">Posts / Month</div>
              <div className="p-4">API Rate</div>
            </div>
            {[
              { plan: "Starter", posts: "1,000", rate: "100 req/min" },
              { plan: "Agency", posts: "10,000", rate: "500 req/min" },
              { plan: "White-Label", posts: "Unlimited", rate: "2,000 req/min" },
            ].map((row, i) => (
              <div
                key={row.plan}
                className={`grid grid-cols-3 text-sm border-b border-gray-900 last:border-0 ${
                  i % 2 === 0 ? "bg-gray-950" : "bg-gray-900/30"
                }`}
              >
                <div className="p-4 text-white font-medium">{row.plan}</div>
                <div className="p-4 text-gray-300">{row.posts}</div>
                <div className="p-4 text-gray-300">{row.rate}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
            <p className="text-gray-400">
              Rate limit headers are returned on every response:
            </p>
            <CodeBlock
              code={`X-RateLimit-Remaining: 842
Retry-After: 60  # seconds until reset (only on 429)`}
              lang="http"
            />
          </div>
        </section>

        {/* Webhooks */}
        <section id="webhooks" className="mb-12 scroll-mt-20">
          <h2 className="text-2xl font-bold text-white mb-4">Webhooks</h2>
          <p className="text-gray-400 text-sm mb-6">
            Configure a webhook URL per profile in Dashboard → Profiles → [Profile] → Settings.
            Fanout sends a POST request to your URL for the following events.
          </p>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Events</h3>
            <div className="space-y-2">
              {[
                { event: "post.published", desc: "All platforms successfully posted" },
                { event: "post.failed", desc: "One or more platforms failed after 3 retries" },
                { event: "token.expiring", desc: "OAuth token expires within 7 days" },
              ].map((e) => (
                <div key={e.event} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                  <code className="text-green-400 font-mono text-sm">{e.event}</code>
                  <span className="text-gray-400 text-sm ml-auto">{e.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-300 mb-3">Payload example</h3>
          <CodeBlock
            code={`{
  "event": "post.published",
  "postId": "a1b2c3d4-...",
  "profileId": "your-profile-uuid",
  "timestamp": "2026-04-01T10:00:05Z",
  "results": [
    { "platform": "twitter", "status": "success", "postUrl": "https://twitter.com/..." },
    { "platform": "linkedin", "status": "success", "postUrl": "https://linkedin.com/..." }
  ]
}`}
            lang="json"
          />

          <div className="mt-6 border border-gray-800 rounded-xl p-5 bg-gray-900">
            <h3 className="text-sm font-semibold text-white mb-2">Need help?</h3>
            <p className="text-gray-400 text-sm">
              Contact{" "}
              <a href="mailto:brad@nustack.digital" className="text-white underline underline-offset-2">
                brad@nustack.digital
              </a>{" "}
              or{" "}
              <Link href="/sign-up" className="text-white underline underline-offset-2">
                start your free trial
              </Link>{" "}
              to get your API key.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
