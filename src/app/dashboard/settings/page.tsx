"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { Copy, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  slug: string;
  webhook_url: string | null;
  timezone: string;
  created_at: string;
}

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "Europe/London",
  "Europe/Paris", "Asia/Tokyo", "Asia/Singapore",
];

export default function SettingsPage() {
  const { user } = useUser();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [webhookEdits, setWebhookEdits] = useState<Record<string, string>>({});
  const [savingWebhook, setSavingWebhook] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [defaultTimezone, setDefaultTimezone] = useState("UTC");
  const [savingTimezone, setSavingTimezone] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/dashboard/profiles")
      .then((r) => r.json())
      .then((d: { profiles: Profile[] }) => {
        setProfiles(d.profiles ?? []);
        const edits: Record<string, string> = {};
        (d.profiles ?? []).forEach((p) => { edits[p.id] = p.webhook_url ?? ""; });
        setWebhookEdits(edits);
      });

    fetch("/api/dashboard/settings")
      .then((r) => r.json())
      .then((d: { defaultTimezone?: string }) => {
        if (d.defaultTimezone) setDefaultTimezone(d.defaultTimezone);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Payment successful! Your plan is now active.");
    }
  }, [searchParams]);

  const startCheckout = useCallback(async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } finally {
      setCheckoutLoading(null);
    }
  }, []);

  function copyToClipboard(text: string, label = "Copied!") {
    navigator.clipboard.writeText(text).then(() => toast.success(label));
  }

  async function regenerateKey(profileId: string, profileName: string) {
    if (!confirm(`Regenerate API key for "${profileName}"? The old key will stop working immediately.`)) return;
    const res = await fetch(`/api/dashboard/profiles/${profileId}/regenerate-key`, { method: "POST" });
    const data = await res.json() as { apiKey?: string; error?: string };
    if (!res.ok) { toast.error(data.error ?? "Failed to regenerate"); return; }
    toast.success("New API key generated! Copy it now — it won't be shown again.");
    if (data.apiKey) {
      await navigator.clipboard.writeText(data.apiKey);
      toast.success(`New key copied to clipboard: ${data.apiKey.slice(0, 8)}...`);
    }
  }

  async function saveTimezone() {
    setSavingTimezone(true);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTimezone }),
      });
      if (res.ok) toast.success("Timezone saved");
      else toast.error("Failed to save timezone");
    } finally {
      setSavingTimezone(false);
    }
  }

  async function saveWebhook(profileId: string) {
    setSavingWebhook(profileId);
    const res = await fetch(`/api/dashboard/profiles/${profileId}/webhook`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: webhookEdits[profileId] }),
    });
    if (res.ok) toast.success("Webhook URL saved");
    else toast.error("Failed to save webhook");
    setSavingWebhook(null);
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account and integrations</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList className="mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Account */}
        <TabsContent value="account">
          <Card className="p-6 border-gray-100">
            <h2 className="font-semibold text-black mb-5">Account details</h2>
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 block">Full name</Label>
                <Input
                  value={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
                  readOnly
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-400 mt-1">Manage via your Clerk profile settings.</p>
              </div>
              <div>
                <Label className="mb-1.5 block">Email</Label>
                <Input
                  value={user?.primaryEmailAddress?.emailAddress ?? ""}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Default timezone</Label>
                <div className="flex gap-2">
                  <select
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
                    value={defaultTimezone}
                    onChange={(e) => setDefaultTimezone(e.target.value)}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveTimezone}
                    disabled={savingTimezone}
                  >
                    {savingTimezone ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="keys">
          <Card className="p-4 border-amber-200 bg-amber-50 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              API keys grant full posting access to a profile. Never expose them in client-side code or public repos.
            </p>
          </Card>
          <Card className="border-gray-100 overflow-hidden">
            {profiles.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No profiles yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {profiles.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-sm text-black">{p.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Created {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <code className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded mt-1 inline-block">
                        sk_••••••••••••••••
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5"
                        onClick={() => copyToClipboard(p.id, "Profile ID copied")}
                      >
                        <Copy className="w-3 h-3" /> Copy ID
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 text-red-600 hover:text-red-700"
                        onClick={() => regenerateKey(p.id, p.name)}
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="webhooks">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Set a webhook URL per profile to receive post status callbacks.
            </p>
            {profiles.length === 0 ? (
              <Card className="p-8 border-dashed border-gray-200 text-center text-gray-400 text-sm">No profiles yet</Card>
            ) : (
              profiles.map((p) => (
                <Card key={p.id} className="p-4 border-gray-100">
                  <div className="font-medium text-sm text-black mb-3">{p.name}</div>
                  <div className="flex gap-2">
                    <Input
                      value={webhookEdits[p.id] ?? ""}
                      onChange={(e) => setWebhookEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="https://your-app.com/api/webhooks/fanout"
                      className="text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveWebhook(p.id)}
                      disabled={savingWebhook === p.id}
                    >
                      {savingWebhook === p.id ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing">
          <Card className="p-6 border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-black">Current Plan</h2>
                <p className="text-gray-500 text-sm mt-0.5">14-day free trial — upgrade to activate posting</p>
              </div>
              <Badge className="bg-indigo-600 text-white">Free Trial</Badge>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Profiles</span>
                <span className="font-medium text-black">{profiles.length} created</span>
              </div>
              <div className="flex justify-between">
                <span>Platforms</span>
                <span className="font-medium text-black">9 / 9</span>
              </div>
            </div>
          </Card>

          <h3 className="font-semibold text-black text-sm mb-4">Choose a plan</h3>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            {[
              { key: "starter", name: "Starter", price: "$49/mo", desc: "3 profiles · 5 platforms" },
              { key: "agency", name: "Agency", price: "$199/mo", desc: "25 profiles · all 9 platforms · AI", highlight: true },
              { key: "white-label", name: "White-Label", price: "$399/mo", desc: "Unlimited profiles · custom domain" },
            ].map((p) => (
              <Card key={p.key} className={`p-4 border ${p.highlight ? "border-black ring-1 ring-black" : "border-gray-100"}`}>
                {p.highlight && <Badge className="bg-black text-white text-xs mb-2">Most popular</Badge>}
                <div className="font-semibold text-black text-sm">{p.name}</div>
                <div className="text-xl font-black text-black mt-1">{p.price}</div>
                <div className="text-xs text-gray-500 mb-3">{p.desc}</div>
                <Button
                  size="sm"
                  className={`w-full text-xs ${p.highlight ? "bg-black text-white hover:bg-gray-800" : "border border-gray-200 text-black hover:bg-gray-50"}`}
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => startCheckout(p.key)}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === p.key ? (
                    "Redirecting…"
                  ) : (
                    <><ExternalLink className="w-3 h-3 mr-1.5" />Subscribe</>
                  )}
                </Button>
              </Card>
            ))}
          </div>
          <p className="text-xs text-gray-400">Payments processed securely by Square. Cancel anytime.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
