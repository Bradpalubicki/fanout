"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, AlertTriangle, CheckSquare, Square } from "lucide-react";

interface OrgProfile {
  id: string;
  name: string;
  slug: string;
}

interface AgencyOrg {
  org_id: string;
  plan_key: string | null;
  status: string | null;
  trial_expires_at: string | null;
  activated_at: string | null;
  profileCount: number;
  platformCount: number;
  profiles: OrgProfile[];
}

interface AgencyOrgCardProps {
  org: AgencyOrg;
}

const PLATFORMS = [
  "linkedin",
  "twitter",
  "facebook",
  "instagram",
  "reddit",
  "pinterest",
  "youtube",
  "tiktok",
  "threads",
];

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
  pinterest: "Pinterest",
  youtube: "YouTube",
  tiktok: "TikTok",
  threads: "Threads",
};

interface ConnectModalProps {
  orgId: string;
  profileId: string;
  profileName: string;
  platform: string;
  onClose: () => void;
}

function ConnectModal({ profileId, profileName, platform, onClose }: ConnectModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  function handleConnect() {
    const url = `/api/oauth/${platform}/authorize?profileId=${profileId}&agency=true`;
    window.open(url, "_blank", "width=600,height=700,noopener,noreferrer");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="max-w-md w-full p-6 bg-white">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-black mb-1">Agency Override — Connect on Behalf</h3>
            <p className="text-sm text-gray-500">
              You are about to connect <strong>{PLATFORM_LABELS[platform] ?? platform}</strong> for{" "}
              <strong>{profileName}</strong>.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>Confirmation required:</strong> By proceeding, you confirm that the client organization has given
            written permission for NuStack Digital Ventures to connect their{" "}
            <strong>{PLATFORM_LABELS[platform] ?? platform}</strong> account on their behalf.
          </p>
        </div>

        <button
          className="flex items-start gap-3 w-full text-left mb-5 group"
          onClick={() => setConfirmed(!confirmed)}
        >
          {confirmed ? (
            <CheckSquare className="w-5 h-5 text-black shrink-0 mt-0.5" />
          ) : (
            <Square className="w-5 h-5 text-gray-400 shrink-0 mt-0.5 group-hover:text-gray-600" />
          )}
          <span className="text-sm text-gray-700">
            I confirm that this client has given written permission for NuStack to connect their{" "}
            {PLATFORM_LABELS[platform] ?? platform} account on their behalf.
          </span>
        </button>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-black text-white hover:bg-gray-800 gap-2"
            disabled={!confirmed}
            onClick={handleConnect}
          >
            Connect {PLATFORM_LABELS[platform] ?? platform}
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function AgencyOrgCard({ org }: AgencyOrgCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<{
    platform: string;
    profileId: string;
    profileName: string;
  } | null>(null);

  const statusColor =
    org.status === "active"
      ? "bg-green-100 text-green-700 border-green-200"
      : org.status === "trial"
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <>
      {modal && (
        <ConnectModal
          orgId={org.org_id}
          profileId={modal.profileId}
          profileName={modal.profileName}
          platform={modal.platform}
          onClose={() => setModal(null)}
        />
      )}

      <Card className="border-gray-100 overflow-hidden">
        {/* Header row */}
        <button
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-purple-700 text-xs font-bold">
                {org.org_id.slice(4, 6).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-black">{org.org_id.slice(0, 24)}…</span>
                <Badge className={`text-xs ${statusColor}`}>{org.status ?? "unknown"}</Badge>
                {org.plan_key && (
                  <Badge variant="outline" className="text-xs text-gray-500">
                    {org.plan_key}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-0.5">
                <span className="text-xs text-gray-400">
                  {org.profileCount} profile{org.profileCount !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-gray-400">
                  {org.platformCount}/9 platforms connected
                </span>
              </div>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          )}
        </button>

        {/* Expanded: profiles + connect buttons */}
        {expanded && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-4">
            {org.profiles.length === 0 ? (
              <p className="text-sm text-gray-400">No profiles yet for this org.</p>
            ) : (
              org.profiles.map((profile) => (
                <div key={profile.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {profile.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-black">{profile.name}</span>
                    <span className="text-xs text-gray-400">{profile.slug}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pl-8">
                    {PLATFORMS.map((platform) => (
                      <Button
                        key={platform}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() =>
                          setModal({
                            platform,
                            profileId: profile.id,
                            profileName: profile.name,
                          })
                        }
                      >
                        {PLATFORM_LABELS[platform]?.split(" ")[0] ?? platform}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </>
  );
}
