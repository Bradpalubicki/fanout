"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  SkipForward,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import { PLATFORM_WALKTHROUGHS, WIZARD_ORDER } from "@/lib/platform-walkthroughs";

interface PlatformConnectWizardProps {
  profileId: string;
  initialConnected: string[];
  onComplete?: () => void;
}

interface PollResult {
  connected: boolean;
  username: string | null;
}

function firstUnconnected(connected: string[]): number {
  const idx = WIZARD_ORDER.findIndex((p) => !connected.includes(p));
  return idx === -1 ? WIZARD_ORDER.length : idx;
}

export function PlatformConnectWizard({
  profileId,
  initialConnected,
  onComplete,
}: PlatformConnectWizardProps) {
  const [connected, setConnected] = useState<string[]>(initialConnected);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    firstUnconnected(initialConnected)
  );
  const [polling, setPolling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPolling(false);
  }, []);

  const advanceToNext = useCallback(
    (newConnected: string[]) => {
      setExpanded(false);
      const next = firstUnconnected(newConnected);
      if (next >= WIZARD_ORDER.length) {
        setDone(true);
        onComplete?.();
      } else {
        setActiveIndex(next);
      }
    },
    [onComplete]
  );

  useEffect(() => {
    if (!polling) return;
    const platform = WIZARD_ORDER[activeIndex];
    if (!platform) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/dashboard/platforms/${platform}?profileId=${profileId}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as PollResult;
        if (data.connected) {
          stopPolling();
          const newConnected = [...connected, platform];
          setConnected(newConnected);
          if (data.username) {
            setUsernames((prev) => ({ ...prev, [platform]: data.username! }));
          }
          advanceToNext(newConnected);
        }
      } catch {
        // silently retry
      }
    }, 3000);

    return () => stopPolling();
  }, [polling, activeIndex, profileId, connected, stopPolling, advanceToNext]);

  function handleConnect(platform: string) {
    const url = `/api/oauth/${platform}/authorize?profileId=${profileId}`;
    window.open(url, "_blank", "width=600,height=700,noopener,noreferrer");
    setPolling(true);
  }

  function handleSkip() {
    stopPolling();
    const platform = WIZARD_ORDER[activeIndex];
    if (!platform) return;
    // Find the next unconnected, unskipped platform after the current index
    const nextActual = WIZARD_ORDER.findIndex(
      (p, i) => i > activeIndex && !connected.includes(p)
    );
    if (nextActual === -1) {
      // No more platforms — done
      setDone(true);
      onComplete?.();
    } else {
      setActiveIndex(nextActual);
      setExpanded(false);
    }
  }

  const totalConnected = connected.filter((c) => !c.startsWith("__skipped_")).length;
  const progressPct = Math.round((totalConnected / 9) * 100);

  if (done || activeIndex >= WIZARD_ORDER.length) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-black mb-2">
            {totalConnected === 9
              ? "All 9 platforms connected!"
              : `${totalConnected}/9 platforms connected`}
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {totalConnected === 9
              ? "Fanout is ready to post across all your platforms automatically."
              : "You can connect remaining platforms anytime from your profile settings."}
          </p>
        </div>

        {totalConnected < 9 && (
          <div className="grid sm:grid-cols-3 gap-2">
            {WIZARD_ORDER.filter((p) => !connected.includes(p)).map((platform) => {
              const w = PLATFORM_WALKTHROUGHS[platform];
              return (
                <Card key={platform} className="p-3 border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${w?.color ?? "bg-gray-400"}`} />
                    <span className="text-sm font-medium text-black">{w?.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => handleConnect(platform)}
                  >
                    Connect <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const activePlatform = WIZARD_ORDER[activeIndex]!;
  const walkthrough = PLATFORM_WALKTHROUGHS[activePlatform];
  const isConnectedNow = connected.includes(activePlatform);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-black">
            {totalConnected}/9 platforms connected
          </span>
          <span className="text-xs text-gray-400">{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Platform dots */}
        <div className="flex gap-1.5 mt-2">
          {WIZARD_ORDER.map((p, i) => (
            <div
              key={p}
              className={`flex-1 h-1 rounded-full transition-all ${
                connected.includes(p)
                  ? "bg-green-500"
                  : i === activeIndex
                  ? "bg-black"
                  : "bg-gray-200"
              }`}
              title={PLATFORM_WALKTHROUGHS[p]?.name}
            />
          ))}
        </div>
      </div>

      {/* Active platform card */}
      {walkthrough && (
        <Card className="border-gray-200 overflow-hidden">
          {/* Header */}
          <div className={`${walkthrough.color} px-5 py-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <span className={`font-bold text-lg ${walkthrough.textColor}`}>
                  {walkthrough.name}
                </span>
                {walkthrough.requiresReview && (
                  <Badge className="bg-yellow-500/20 text-yellow-100 border-yellow-400/30 text-xs">
                    App review pending
                  </Badge>
                )}
                {walkthrough.requiresMeta && (
                  <Badge className="bg-white/20 text-white border-white/30 text-xs">
                    Requires Meta verification
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className={`w-3 h-3 ${walkthrough.textColor} opacity-70`} />
                <span className={`text-xs ${walkthrough.textColor} opacity-70`}>
                  {walkthrough.timeEstimate}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* What you're approving */}
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                  What you&apos;re approving
                </p>
                <p className="text-sm text-gray-700">{walkthrough.approving}</p>
              </div>
            </div>

            {/* Review warning for Meta */}
            {walkthrough.requiresMeta && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Facebook, Instagram, and Threads require Meta Business Verification (1–3 business days). NuStack is handling this — you&apos;ll be notified when it&apos;s ready.
                </p>
              </div>
            )}

            {/* Expandable steps */}
            <button
              className="w-full flex items-center justify-between text-left py-2 border-t border-gray-100"
              onClick={() => setExpanded(!expanded)}
            >
              <span className="text-sm font-medium text-black">
                What happens when I click Connect?
              </span>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {expanded && (
              <div className="space-y-2 pb-1">
                {walkthrough.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-gray-600">{step}</p>
                  </div>
                ))}
                <div className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2.5 mt-2">
                  <span className="text-xs font-semibold text-gray-500">Tip:</span>
                  <p className="text-xs text-gray-600">{walkthrough.tips}</p>
                </div>
              </div>
            )}

            {/* Action area */}
            <div className="pt-1">
              {polling && !isConnectedNow && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for authorization… keep this tab open</span>
                </div>
              )}

              {isConnectedNow ? (
                <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Connected{usernames[activePlatform] ? ` as @${usernames[activePlatform]}` : ""}
                  </span>
                </div>
              ) : walkthrough.requiresReview ? (
                <div className="space-y-2">
                  <Button disabled className="w-full bg-gray-100 text-gray-400 cursor-not-allowed">
                    Connect {walkthrough.name} — Coming Soon
                  </Button>
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
                    onClick={handleSkip}
                  >
                    Skip this platform →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    className="w-full bg-black text-white hover:bg-gray-800 gap-2"
                    onClick={() => handleConnect(activePlatform)}
                    disabled={polling}
                  >
                    {polling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Waiting for authorization…
                      </>
                    ) : (
                      <>
                        Connect {walkthrough.name}
                        <ExternalLink className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  <button
                    className="text-xs text-gray-400 hover:text-gray-600 w-full text-center flex items-center justify-center gap-1"
                    onClick={handleSkip}
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip this platform
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Upcoming platforms (compact) */}
      {WIZARD_ORDER.slice(activeIndex + 1)
        .filter((p) => !connected.includes(p))
        .slice(0, 4)
        .map((platform) => {
          const w = PLATFORM_WALKTHROUGHS[platform];
          return (
            <div
              key={platform}
              className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl opacity-50"
            >
              <div className={`w-2 h-2 rounded-full ${w?.color ?? "bg-gray-300"}`} />
              <span className="text-sm text-gray-500">{w?.name}</span>
              {w?.requiresReview && (
                <Badge variant="outline" className="text-xs text-gray-400 ml-auto">
                  Review pending
                </Badge>
              )}
              {w?.requiresMeta && (
                <Badge variant="outline" className="text-xs text-gray-400 ml-auto">
                  Meta verification
                </Badge>
              )}
            </div>
          );
        })}

      {/* Already connected platforms */}
      {connected.filter((p) => !p.startsWith("__skipped_")).length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Connected</p>
          <div className="flex flex-wrap gap-2">
            {connected
              .filter((p) => !p.startsWith("__skipped_"))
              .map((platform) => {
                const w = PLATFORM_WALKTHROUGHS[platform];
                return (
                  <div
                    key={platform}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg"
                  >
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-xs font-medium text-green-700">{w?.name}</span>
                    {usernames[platform] && (
                      <span className="text-xs text-green-500">@{usernames[platform]}</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Skip all */}
      <div className="text-center pt-2">
        <button
          className="text-xs text-gray-400 hover:text-gray-600"
          onClick={() => {
            stopPolling();
            setDone(true);
            onComplete?.();
          }}
        >
          I&apos;ll connect platforms later →
        </button>
      </div>
    </div>
  );
}
