"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";

interface Token {
  platform: string;
  platform_username: string | null;
}

export function PlatformGrid({ profileId, tokens }: { profileId: string; tokens: Token[] }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
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

  return (
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
  );
}
