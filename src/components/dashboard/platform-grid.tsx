"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";

interface Token {
  platform: string;
  platform_username: string | null;
}

// Platforms that use custom credential dialogs instead of OAuth
const CREDENTIAL_PLATFORMS = ['bluesky', 'mastodon'] as const;
type CredentialPlatform = typeof CREDENTIAL_PLATFORMS[number];

function BlueskyDialog({ profileId, onClose, onSuccess }: { profileId: string; onClose: () => void; onSuccess: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!identifier.trim() || !password.trim()) { toast.error('Enter your handle and app password'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/platforms/bluesky/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, identifier: identifier.trim(), password: password.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? 'Failed to connect'); return; }
      toast.success('Bluesky connected!');
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-black">Connect Bluesky</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Use an <strong>app password</strong> (not your main password). Create one at{' '}
          <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            bsky.app/settings/app-passwords
          </a>.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="yourhandle.bsky.social"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx (app password)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <Button
            className="w-full bg-[#0085ff] hover:bg-[#006dcc] text-white"
            onClick={save}
            disabled={saving}
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</> : 'Connect Bluesky'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MastodonDialog({ profileId, onClose, onSuccess }: { profileId: string; onClose: () => void; onSuccess: () => void }) {
  const [instanceUrl, setInstanceUrl] = useState('https://mastodon.social');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!instanceUrl.trim() || !accessToken.trim()) { toast.error('Enter your instance URL and access token'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/platforms/mastodon/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, instanceUrl: instanceUrl.trim().replace(/\/$/, ''), accessToken: accessToken.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? 'Failed to connect'); return; }
      toast.success('Mastodon connected!');
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-black">Connect Mastodon</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Create an access token in your Mastodon instance: <strong>Settings → Development → New Application</strong>.
          Grant <code className="bg-gray-100 px-1 rounded text-[10px]">write:statuses write:media</code> scopes.
        </p>
        <div className="space-y-3">
          <input
            type="url"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
            placeholder="https://mastodon.social"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Your access token"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <Button
            className="w-full bg-[#563acc] hover:bg-[#4527a0] text-white"
            onClick={save}
            disabled={saving}
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</> : 'Connect Mastodon'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PlatformGrid({ profileId, tokens }: { profileId: string; tokens: Token[] }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [credentialDialog, setCredentialDialog] = useState<CredentialPlatform | null>(null);
  const connected = tokens.map((t) => t.platform);

  async function disconnect(platform: string) {
    if (!confirm(`Disconnect ${platform}? This will stop posting to this platform.`)) return;
    setDisconnecting(platform);
    try {
      const res = await fetch(`/api/dashboard/platforms/${platform}?profileId=${profileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`${platform} disconnected`);
        router.refresh();
      } else {
        const d = await res.json() as { error?: string };
        toast.error(d.error ?? "Failed to disconnect");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDisconnecting(null);
    }
  }

  function handleCredentialSuccess() {
    setCredentialDialog(null);
    router.refresh();
  }

  const isCredentialPlatform = (p: string): p is CredentialPlatform =>
    CREDENTIAL_PLATFORMS.includes(p as CredentialPlatform);

  return (
    <>
      {credentialDialog === 'bluesky' && (
        <BlueskyDialog
          profileId={profileId}
          onClose={() => setCredentialDialog(null)}
          onSuccess={handleCredentialSuccess}
        />
      )}
      {credentialDialog === 'mastodon' && (
        <MastodonDialog
          profileId={profileId}
          onClose={() => setCredentialDialog(null)}
          onSuccess={handleCredentialSuccess}
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const token = tokens.find((t) => t.platform === platform);
          const isConnected = connected.includes(platform);
          return (
            <div
              key={platform}
              className={`border rounded-xl p-4 ${
                isConnected ? "border-green-100 bg-green-50/30" : "border-gray-100"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black">
                  {PLATFORM_LABELS[platform as Platform]}
                </span>
                {isConnected ? (
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Connected</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-400">Not connected</Badge>
                )}
              </div>
              {isConnected && token?.platform_username && (
                <p className="text-xs text-gray-500 mb-3">@{token.platform_username}</p>
              )}
              {isConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs text-red-600 hover:text-red-700 border-red-200"
                  onClick={() => disconnect(platform)}
                  disabled={disconnecting === platform}
                >
                  {disconnecting === platform ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : isCredentialPlatform(platform) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => setCredentialDialog(platform)}
                >
                  Connect
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                  <Link href={`/api/oauth/${platform}/authorize?profileId=${profileId}`}>
                    Connect
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
