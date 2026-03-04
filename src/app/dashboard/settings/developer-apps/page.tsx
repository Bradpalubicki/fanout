"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { savePlatformCredentials } from "@/app/actions/save-platform-credentials";

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

interface PlatformDef {
  id: string;
  name: string;
  color: string;
  portalUrl: string;
  portalLabel: string;
  callbackEnv: string;
  callbackPath: string;
  fields: Array<{ env: string; label: string; placeholder: string; isSecret: boolean }>;
  steps: string[];
  requiredScopes: string[];
  approvalTime: string;
  notes?: string;
}

const BASE_URL = "https://fanout.digital";

const PLATFORMS: PlatformDef[] = [
  {
    id: "twitter",
    name: "Twitter / X",
    color: "bg-black",
    portalUrl: "https://developer.twitter.com/en/portal/projects-and-apps",
    portalLabel: "developer.twitter.com",
    callbackEnv: "TWITTER_CALLBACK_URL",
    callbackPath: "/api/oauth/twitter/callback",
    fields: [
      { env: "TWITTER_CLIENT_ID", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", isSecret: false },
      { env: "TWITTER_CLIENT_SECRET", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Sign in to developer.twitter.com with your Twitter account",
      "Click \"+ Create Project\" → give it a name (e.g. NuStack Fanout)",
      "Choose \"Production\" app environment",
      "Under \"User authentication settings\" → enable OAuth 2.0",
      "Set Type of App to \"Web App\"",
      "Add the callback URL shown below under \"Redirect URIs\"",
      "Copy Client ID and Client Secret → paste below",
    ],
    requiredScopes: ["tweet.write", "tweet.read", "users.read", "offline.access"],
    approvalTime: "Instant",
    notes: "Free Basic tier allows 1,500 tweets/month. Enough for testing.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "bg-blue-700",
    portalUrl: "https://www.linkedin.com/developers/apps",
    portalLabel: "linkedin.com/developers/apps",
    callbackEnv: "LINKEDIN_CALLBACK_URL",
    callbackPath: "/api/oauth/linkedin/callback",
    fields: [
      { env: "LINKEDIN_CLIENT_ID", label: "Client ID", placeholder: "86xxxxxxxxxx", isSecret: false },
      { env: "LINKEDIN_CLIENT_SECRET", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Go to linkedin.com/developers/apps → click \"Create app\"",
      "App name: Fanout by NuStack | LinkedIn Page: your company page",
      "After creation → go to \"Auth\" tab",
      "Add the callback URL shown below under \"Authorized redirect URLs\"",
      "Go to \"Products\" tab → request \"Share on LinkedIn\" + \"Sign In with LinkedIn using OpenID Connect\"",
      "Copy Client ID and Client Secret from Auth tab → paste below",
    ],
    requiredScopes: ["w_member_social", "r_liteprofile", "openid", "profile", "email"],
    approvalTime: "Instant (Share on LinkedIn is auto-approved)",
    notes: "Must have a LinkedIn Company Page before creating the app.",
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "bg-blue-600",
    portalUrl: "https://developers.facebook.com/apps",
    portalLabel: "developers.facebook.com",
    callbackEnv: "FACEBOOK_CALLBACK_URL",
    callbackPath: "/api/oauth/facebook/callback",
    fields: [
      { env: "FACEBOOK_APP_ID", label: "App ID", placeholder: "1234567890123456", isSecret: false },
      { env: "FACEBOOK_APP_SECRET", label: "App Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Go to developers.facebook.com → My Apps → Create App",
      "Choose \"Business\" type → enter app name",
      "Add \"Facebook Login\" product → go to its Settings",
      "Add the callback URL shown below under \"Valid OAuth Redirect URIs\"",
      "Go to Settings → Basic → copy App ID and App Secret",
      "Paste below. Note: live posting requires Business Verification.",
    ],
    requiredScopes: ["pages_manage_posts", "pages_show_list", "pages_read_engagement"],
    approvalTime: "App creation instant; Business Verification 1-3 days",
    notes: "App ID and Secret already detected in your Vercel env. Update here if they change.",
  },
  {
    id: "instagram",
    name: "Instagram",
    color: "bg-gradient-to-r from-purple-600 to-pink-500",
    portalUrl: "https://developers.facebook.com/apps",
    portalLabel: "developers.facebook.com (same app as Facebook)",
    callbackEnv: "FACEBOOK_CALLBACK_URL",
    callbackPath: "/api/oauth/facebook/callback",
    fields: [
      { env: "INSTAGRAM_APP_ID", label: "App ID (same Meta app)", placeholder: "1234567890123456", isSecret: false },
      { env: "INSTAGRAM_APP_SECRET", label: "App Secret (same Meta app)", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Instagram uses the same Meta app as Facebook",
      "In your Meta app → click \"Add Product\" → add \"Instagram Graph API\"",
      "Under Instagram Graph API → Settings → add Instagram Business accounts",
      "Add the callback URL shown below under \"Valid OAuth Redirect URIs\"",
      "Use the same App ID and App Secret as your Facebook app",
    ],
    requiredScopes: ["instagram_business_basic", "instagram_business_content_publish"],
    approvalTime: "Instant (uses existing Meta app)",
    notes: "Requires an Instagram Professional (Business or Creator) account linked to a Facebook Page.",
  },
  {
    id: "threads",
    name: "Threads",
    color: "bg-gray-900",
    portalUrl: "https://developers.facebook.com/apps",
    portalLabel: "developers.facebook.com (same Meta app)",
    callbackEnv: "FACEBOOK_CALLBACK_URL",
    callbackPath: "/api/oauth/facebook/callback",
    fields: [
      { env: "THREADS_APP_ID", label: "App ID (same Meta app)", placeholder: "1234567890123456", isSecret: false },
      { env: "THREADS_APP_SECRET", label: "App Secret (same Meta app)", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Threads uses the same Meta app as Facebook and Instagram",
      "In your Meta app → click \"Add Product\" → add \"Threads API\"",
      "Configure scopes: threads_basic + threads_content_publish",
      "Add the callback URL shown below under \"Valid OAuth Redirect URIs\"",
      "Use the same App ID and App Secret as Facebook/Instagram",
    ],
    requiredScopes: ["threads_basic", "threads_content_publish"],
    approvalTime: "Instant (uses existing Meta app)",
    notes: "App ID and Secret already detected. Threads API launched 2024 — no extra review for basic posting.",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    color: "bg-red-600",
    portalUrl: "https://developers.pinterest.com/apps/",
    portalLabel: "developers.pinterest.com",
    callbackEnv: "PINTEREST_CALLBACK_URL",
    callbackPath: "/api/oauth/pinterest/callback",
    fields: [
      { env: "PINTEREST_APP_ID", label: "App ID", placeholder: "1234567", isSecret: false },
      { env: "PINTEREST_APP_SECRET", label: "App Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Go to developers.pinterest.com → Connect app → Create app",
      "Fill in app name, description, website URL (fanout.digital)",
      "Under \"Redirect URIs\" add the callback URL shown below",
      "Request scopes: pins:write, boards:read, user_accounts:read",
      "Submit for review (basic access is usually fast)",
      "Copy App ID and App Secret → paste below",
    ],
    requiredScopes: ["pins:write", "boards:read", "user_accounts:read"],
    approvalTime: "1-3 business days",
    notes: "Pinterest requires a business account. App review is fairly quick for standard scopes.",
  },
  {
    id: "youtube",
    name: "YouTube",
    color: "bg-red-600",
    portalUrl: "https://console.cloud.google.com/apis/credentials",
    portalLabel: "console.cloud.google.com",
    callbackEnv: "YOUTUBE_CALLBACK_URL",
    callbackPath: "/api/oauth/youtube/callback",
    fields: [
      { env: "YOUTUBE_CLIENT_ID", label: "Client ID", placeholder: "xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com", isSecret: false },
      { env: "YOUTUBE_CLIENT_SECRET", label: "Client Secret", placeholder: "GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Go to console.cloud.google.com → New Project → name it \"Fanout\"",
      "APIs & Services → Enable APIs → search and enable \"YouTube Data API v3\"",
      "APIs & Services → Credentials → Create Credentials → OAuth Client ID",
      "Application type: Web Application",
      "Add the callback URL shown below under \"Authorized redirect URIs\"",
      "Also add \"https://fanout.digital\" under \"Authorized JavaScript origins\"",
      "Download or copy Client ID and Client Secret → paste below",
      "OAuth Consent Screen: add brad@nustack.digital as a test user while in testing mode",
    ],
    requiredScopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
    ],
    approvalTime: "Instant for test users; full publish review ~1 week",
    notes: "In testing mode up to 100 users can connect. Submit for verification when ready to scale.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "bg-black",
    portalUrl: "https://developers.tiktok.com/",
    portalLabel: "developers.tiktok.com",
    callbackEnv: "TIKTOK_CALLBACK_URL",
    callbackPath: "/api/oauth/tiktok/callback",
    fields: [
      { env: "TIKTOK_CLIENT_KEY", label: "Client Key", placeholder: "aw7xxxxxxxxxxxxxxxx", isSecret: false },
      { env: "TIKTOK_CLIENT_SECRET", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Go to developers.tiktok.com → sign in with TikTok account",
      "Manage Apps → Create an App → Web category",
      "App name: Fanout by NuStack | Platform: Web",
      "Add product: \"Content Posting API\"",
      "Under \"Login Kit\" → add the callback URL shown below as redirect URI",
      "Submit for review — approval takes 5-7 business days",
      "Once approved, copy Client Key and Client Secret → paste below",
    ],
    requiredScopes: ["video.upload", "video.publish", "user.info.basic"],
    approvalTime: "5-7 business days",
    notes: "TikTok has a manual review process. Submit the app as soon as possible so the clock starts.",
  },
  {
    id: "reddit",
    name: "Reddit",
    color: "bg-orange-500",
    portalUrl: "https://www.reddit.com/prefs/apps",
    portalLabel: "reddit.com/prefs/apps",
    callbackEnv: "REDDIT_CALLBACK_URL",
    callbackPath: "/api/oauth/reddit/callback",
    fields: [
      { env: "REDDIT_CLIENT_ID", label: "Client ID", placeholder: "xxxxxxxxxxxxxxxxxxxx", isSecret: false },
      { env: "REDDIT_CLIENT_SECRET", label: "Client Secret", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", isSecret: true },
    ],
    steps: [
      "Go to reddit.com/prefs/apps while logged into your Reddit account",
      "Scroll down → \"are you a developer? create an app\"",
      "Name: Fanout by NuStack | Type: web app",
      "About URL: https://fanout.digital",
      "Add the callback URL shown below as the redirect URI",
      "Click \"create app\" → copy the client ID (shown under the app name) and secret",
      "Paste below — Reddit approval is instant for basic scopes",
    ],
    requiredScopes: ["submit", "read", "identity"],
    approvalTime: "Instant",
    notes: "Reddit app creation is self-service. No review required for these scopes.",
  },
];

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function MaskedInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  id: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 text-sm font-mono"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PlatformCard({ platform }: { platform: PlatformDef }) {
  const callbackUrl = `${BASE_URL}${platform.callbackPath}`;
  const [open, setOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(platform.fields.map((f) => [f.env, ""]))
  );
  const [isPending, startTransition] = useTransition();

  function copyCallback() {
    navigator.clipboard.writeText(callbackUrl).then(() =>
      toast.success("Callback URL copied!")
    );
  }

  const allFilled = platform.fields.every((f) => values[f.env].trim() !== "");

  function handleSave() {
    startTransition(async () => {
      const result = await savePlatformCredentials(platform.id, values);
      if (result.success) {
        toast.success(`${platform.name} credentials saved to Vercel. Redeploy to activate.`);
      } else {
        toast.error(result.error ?? "Failed to save credentials");
      }
    });
  }

  return (
    <Card className="border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${platform.color}`} />
          <span className="font-medium text-sm text-black">{platform.name}</span>
          <Badge variant="outline" className="text-xs text-gray-400">
            {platform.approvalTime}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {allFilled && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-5">
          {/* Callback URL */}
          <div>
            <Label className="mb-1.5 block text-xs text-gray-500 uppercase tracking-wide">
              Callback URL — paste this into the developer portal
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate">
                {callbackUrl}
              </code>
              <Button size="sm" variant="outline" onClick={copyCallback} className="shrink-0 gap-1.5 text-xs">
                <Copy className="w-3 h-3" /> Copy
              </Button>
            </div>
          </div>

          {/* Required scopes info */}
          <div>
            <Label className="mb-1.5 block text-xs text-gray-500 uppercase tracking-wide">
              Required Scopes
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {platform.requiredScopes.map((s) => (
                <code key={s} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                  {s}
                </code>
              ))}
            </div>
          </div>

          {/* Step-by-step guide */}
          <div>
            <button
              type="button"
              onClick={() => setStepsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {stepsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {stepsOpen ? "Hide" : "Show"} step-by-step guide
            </button>
            {stepsOpen && (
              <ol className="mt-3 space-y-2">
                {platform.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
            {platform.notes && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {platform.notes}
              </div>
            )}
          </div>

          {/* Open portal button */}
          <a
            href={platform.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <ExternalLink className="w-3 h-3" />
            Open {platform.portalLabel}
          </a>

          {/* Credential fields */}
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs text-gray-500 font-medium">Paste credentials from the developer portal</p>
            {platform.fields.map((field) => (
              <div key={field.env}>
                <Label htmlFor={`${platform.id}-${field.env}`} className="mb-1.5 block text-sm">
                  {field.label}
                  <code className="ml-2 text-xs text-gray-400">{field.env}</code>
                </Label>
                {field.isSecret ? (
                  <MaskedInput
                    id={`${platform.id}-${field.env}`}
                    value={values[field.env]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.env]: v }))}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    id={`${platform.id}-${field.env}`}
                    value={values[field.env]}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.env]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="text-sm font-mono"
                  />
                )}
              </div>
            ))}
            <Button
              onClick={handleSave}
              disabled={!allFilled || isPending}
              className="w-full bg-black text-white hover:bg-gray-800 text-sm"
            >
              {isPending ? "Saving to Vercel…" : `Save ${platform.name} credentials`}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Credentials are saved as encrypted Vercel env vars. A redeploy activates them.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PLATFORM_ORDER = [
  "twitter", "linkedin", "reddit",        // instant approval
  "facebook", "instagram", "threads",      // meta (same app)
  "pinterest", "youtube", "tiktok",        // review required
];

export default function DeveloperAppsPage() {
  const ordered = PLATFORM_ORDER.map((id) => PLATFORMS.find((p) => p.id === id)!);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Developer Apps</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Connect each platform by creating a developer app and pasting the credentials below.
          Fanout handles all OAuth, token storage, and refresh automatically.
        </p>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: "Instant approval", desc: "Twitter, LinkedIn, Reddit" },
          { icon: <Circle className="w-4 h-4 text-blue-500" />, label: "Same Meta app", desc: "Facebook, Instagram, Threads" },
          { icon: <AlertCircle className="w-4 h-4 text-amber-500" />, label: "Review required", desc: "Pinterest, YouTube, TikTok" },
        ].map((item) => (
          <Card key={item.label} className="p-3 border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              {item.icon}
              <span className="text-xs font-medium text-black">{item.label}</span>
            </div>
            <p className="text-xs text-gray-400">{item.desc}</p>
          </Card>
        ))}
      </div>

      {/* Platform cards */}
      <div className="space-y-3">
        {ordered.map((platform) => (
          <PlatformCard key={platform.id} platform={platform} />
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        After saving credentials, trigger a Vercel redeploy from your dashboard or push a new commit.
        Then go to Profiles → connect each platform via OAuth.
      </p>
    </div>
  );
}
