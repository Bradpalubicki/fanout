import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v1/post",
    description: "Post to one or more platforms immediately",
    auth: true,
    body: `{
  "post": "Your content here",
  "platforms": ["twitter", "linkedin"],
  "mediaUrls": ["https://example.com/image.jpg"],
  "profileId": "your-profile-slug"
}`,
    response: `{
  "status": "queued",
  "id": "post-uuid"
}`,
  },
  {
    method: "POST",
    path: "/api/v1/schedule",
    description: "Schedule a post for a future time",
    auth: true,
    body: `{
  "post": "Your content here",
  "platforms": ["twitter"],
  "profileId": "your-profile-slug",
  "scheduledFor": "2026-04-01T10:00:00Z"
}`,
    response: `{
  "status": "scheduled",
  "id": "post-uuid",
  "scheduledFor": "2026-04-01T10:00:00Z"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/platforms",
    description: "Get connected platforms for your profile",
    auth: true,
    response: `{
  "platforms": [
    {
      "platform": "twitter",
      "connected": true,
      "username": "youraccount",
      "expiresAt": "2026-06-01T00:00:00Z"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/analytics/[postId]",
    description: "Get analytics for a specific post",
    auth: true,
    response: `{
  "postId": "uuid",
  "totals": { "likes": 42, "impressions": 1200 },
  "platforms": [
    { "platform": "twitter", "status": "success", "analytics": { "likes": 25 } }
  ]
}`,
  },
  {
    method: "DELETE",
    path: "/api/v1/platforms/[platform]",
    description: "Disconnect a platform",
    auth: true,
    response: `{ "success": true, "platform": "twitter", "disconnected": true }`,
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
  DELETE: "bg-red-100 text-red-700",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-lg">Fanout</span>
            <span className="text-gray-400 text-sm ml-1">/ Docs</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-black mb-4">API Reference</h1>
        <p className="text-gray-600 text-lg mb-12">
          One API key per profile. Bearer token authentication. All inputs validated with Zod.
        </p>

        {/* Auth */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-black mb-4">Authentication</h2>
          <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm text-gray-300">
            Authorization: Bearer YOUR_API_KEY
          </div>
          <p className="text-gray-500 text-sm mt-3">
            API keys are per-profile. Generate them in{" "}
            <Link href="/dashboard/profiles" className="text-black underline">
              Dashboard → Profiles
            </Link>
            .
          </p>
        </div>

        {/* Base URL */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-black mb-4">Base URL</h2>
          <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm text-green-400">
            https://fanout.digital
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-8">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
                <Badge className={`font-mono text-xs ${METHOD_COLORS[ep.method] ?? ""} border-0`}>
                  {ep.method}
                </Badge>
                <code className="font-mono text-sm font-semibold text-black">{ep.path}</code>
                {ep.auth && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    Auth required
                  </Badge>
                )}
              </div>
              <div className="p-4">
                <p className="text-gray-600 text-sm mb-4">{ep.description}</p>
                {ep.body && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Request body</p>
                    <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto mb-4">
                      {ep.body}
                    </pre>
                  </>
                )}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Response</p>
                <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto">
                  {ep.response}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* OAuth */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-black mb-4">OAuth Connect Flow</h2>
          <p className="text-gray-600 mb-6">
            Connect social platforms via the dashboard at{" "}
            <Link href="/dashboard/profiles" className="text-black underline">
              /dashboard/profiles/[id]
            </Link>
            . Each platform redirects through our OAuth handler.
          </p>
          <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm text-gray-300">
            <div className="text-gray-500 mb-2"># Initiate OAuth for any platform</div>
            <div className="text-green-400">GET /api/oauth/[platform]/authorize?profileId=YOUR_PROFILE_UUID</div>
            <div className="text-gray-500 mt-3 mb-2"># Callback URL (configure in platform app settings)</div>
            <div className="text-blue-400">https://fanout.digital/api/oauth/[platform]/callback</div>
          </div>
        </div>
      </div>
    </div>
  );
}
