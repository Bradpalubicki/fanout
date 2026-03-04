"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

interface Page {
  id: string;
  name: string;
  pageId?: string;
  pageName?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Business Account",
  threads: "Threads Profile",
};

const PLATFORM_HELP: Record<string, string> = {
  facebook: "Select the Facebook Page you want to post to. Only Pages you manage are shown.",
  instagram: "Select the Instagram Business Account linked to your Facebook Page.",
  threads: "Your Threads profile was found automatically.",
};

export default function SelectPagePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = params.id as string;
  const platform = searchParams.get("platform") ?? "facebook";

  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/oauth/select-page?profileId=${profileId}&platform=${platform}`)
      .then((r) => r.json())
      .then((d: { pages?: Page[]; error?: string }) => {
        if (d.error) {
          setError(d.error);
        } else {
          setPages(d.pages ?? []);
          // Auto-select if only one option (e.g. Threads)
          if (d.pages?.length === 1) setSelected(d.pages[0].id);
        }
      })
      .catch(() => setError("Failed to load accounts"))
      .finally(() => setLoading(false));
  }, [profileId, platform]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const page = pages.find((p) => p.id === selected);
    try {
      const res = await fetch("/api/oauth/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          platform,
          pageId: selected,
          pageName: page?.name,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success(`${PLATFORM_LABELS[platform] ?? platform} connected!`);
      router.push(`/dashboard/profiles/${profileId}?connected=${platform}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <button
        onClick={() => router.push(`/dashboard/profiles/${profileId}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to profile
      </button>

      <h1 className="text-2xl font-bold text-black mb-1">
        Select {PLATFORM_LABELS[platform] ?? "account"}
      </h1>
      <p className="text-gray-500 text-sm mb-6">{PLATFORM_HELP[platform]}</p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
        </div>
      )}

      {error && (
        <Card className="p-5 border-red-100 bg-red-50/30">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/profiles/${profileId}`)}>
            Go back
          </Button>
        </Card>
      )}

      {!loading && !error && pages.length === 0 && (
        <Card className="p-8 border-dashed border-gray-200 text-center">
          <p className="text-gray-500 text-sm mb-2">No accounts found.</p>
          {platform === "instagram" && (
            <p className="text-gray-400 text-xs">
              Make sure your Instagram account is a Business or Creator account linked to a Facebook Page.
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push(`/dashboard/profiles/${profileId}`)}>
            Go back
          </Button>
        </Card>
      )}

      {!loading && pages.length > 0 && (
        <div className="space-y-3 mb-6">
          {pages.map((page) => (
            <Card
              key={page.id}
              onClick={() => setSelected(page.id)}
              className={`p-4 cursor-pointer transition-all ${
                selected === page.id
                  ? "border-black bg-gray-50"
                  : "border-gray-100 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-black">{page.name}</div>
                  {page.pageName && (
                    <div className="text-xs text-gray-400 mt-0.5">via {page.pageName}</div>
                  )}
                  <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {page.id}</div>
                </div>
                {selected === page.id && (
                  <CheckCircle2 className="w-5 h-5 text-black shrink-0" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && pages.length > 0 && (
        <div className="flex gap-3">
          <Button
            className="bg-black text-white hover:bg-gray-800 flex-1"
            onClick={handleSave}
            disabled={!selected || saving}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting…</>
            ) : (
              `Connect ${PLATFORM_LABELS[platform] ?? "account"}`
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/profiles/${profileId}`)}
          >
            Cancel
          </Button>
        </div>
      )}

      {platform === "threads" && pages.length === 1 && !loading && (
        <Badge className="mt-3 bg-purple-50 text-purple-700 border-purple-200 text-xs">
          Threads profile auto-detected
        </Badge>
      )}
    </div>
  );
}
