"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import Link from "next/link";
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";

interface Profile {
  id: string;
  name: string;
  slug: string;
}

interface AiDraft {
  platform: string;
  content: string;
}

interface SavedDraft {
  id: string;
  prompt: string;
  generated: string;
  platforms: string[];
  status: string;
  created_at: string;
}

export default function AiDraftsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["twitter", "linkedin"]);
  const [drafts, setDrafts] = useState<AiDraft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [generating, setGenerating] = useState(false);
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgPlatform, setImgPlatform] = useState<string>("default");
  const [imgGenerating, setImgGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/profiles")
      .then((r) => r.json())
      .then((d: { profiles: Profile[] }) => {
        setProfiles(d.profiles ?? []);
        if (d.profiles?.length > 0) setSelectedProfile(d.profiles[0].id);
      });
    fetch("/api/ai/drafts")
      .then((r) => r.json())
      .then((d: { drafts?: SavedDraft[] }) => setSavedDrafts(d.drafts ?? []));
  }, []);

  function togglePlatform(p: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function generate() {
    if (!prompt.trim()) { toast.error("Describe what you want to post"); return; }
    if (!selectedProfile) { toast.error("Select a profile"); return; }
    if (selectedPlatforms.length === 0) { toast.error("Select at least one platform"); return; }

    setGenerating(true);
    setDrafts([]);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platforms: selectedPlatforms, profileId: selectedProfile }),
      });
      const data = await res.json() as { drafts?: AiDraft[]; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      setDrafts(data.drafts ?? []);
      toast.success("Drafts generated!");
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage() {
    if (!imgPrompt.trim()) { toast.error("Enter an image prompt"); return; }
    setImgGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt, platform: imgPlatform }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      setGeneratedImages((prev) => [data.url!, ...prev]);
      toast.success("Image generated!");
    } catch {
      toast.error("Image generation failed");
    } finally {
      setImgGenerating(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">AI Drafts</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generate platform-optimized content with Claude</p>
      </div>

      {/* Generate form */}
      <Card className="p-6 border-gray-100 mb-8">
        <h2 className="font-semibold text-black mb-4">Generate a draft</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-black mb-2 block">Profile</label>
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-black mb-2 block">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedPlatforms.includes(p)
                      ? "border-black bg-black text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-black mb-2 block">Topic or draft</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to post about, or paste a rough draft..."
              className="min-h-24 text-sm"
            />
          </div>

          <Button
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="bg-black text-white hover:bg-gray-800"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {generating ? "Generating..." : "Generate variants"}
          </Button>
        </div>
      </Card>

      {/* AI Image Generation */}
      <Card className="p-6 border-gray-100 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-4 h-4 text-purple-600" />
          <h2 className="font-semibold text-black">AI Image Generator</h2>
          <span className="text-xs text-gray-400 ml-auto">Flux Schnell · ~5s</span>
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              placeholder="Describe the image you want to generate…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-300"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generateImage(); } }}
            />
            <Select value={imgPlatform} onValueChange={setImgPlatform}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (16:9)</SelectItem>
                <SelectItem value="twitter">Twitter (16:9)</SelectItem>
                <SelectItem value="instagram">Instagram (1:1)</SelectItem>
                <SelectItem value="linkedin">LinkedIn (1.91:1)</SelectItem>
                <SelectItem value="pinterest">Pinterest (2:3)</SelectItem>
                <SelectItem value="facebook">Facebook (1.91:1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={generateImage}
            disabled={imgGenerating || !imgPrompt.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {imgGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><Wand2 className="w-4 h-4 mr-2" />Generate image</>}
          </Button>

          {generatedImages.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {generatedImages.map((url, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Generated" className="w-40 h-28 object-cover rounded-lg border border-gray-200" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white text-xs font-medium"
                  >
                    Open full size
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Generated drafts */}
      {generating && (
        <div className="space-y-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-black mb-4">Generated variants</h2>
          <div className="space-y-3">
            {drafts.map((draft) => (
              <Card key={draft.platform} className="p-4 border-purple-100 bg-purple-50/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Badge variant="outline" className="text-xs mb-2 border-purple-200 text-purple-700">
                      {PLATFORM_LABELS[draft.platform as Platform] ?? draft.platform}
                    </Badge>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{draft.content}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" className="bg-black text-white hover:bg-gray-800 text-xs" asChild>
                      <Link
                        href={`/dashboard/compose?content=${encodeURIComponent(draft.content)}&profileId=${selectedProfile}`}
                      >
                        Use in Compose
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Saved drafts */}
      {savedDrafts.length > 0 && (
        <div>
          <h2 className="font-semibold text-black mb-4 text-sm text-gray-500">Previous drafts</h2>
          <div className="space-y-3">
            {savedDrafts.map((saved) => {
              let parsedDrafts: AiDraft[] = [];
              try { parsedDrafts = JSON.parse(saved.generated) as AiDraft[]; } catch { /* */ }
              return (
                <Card key={saved.id} className="p-4 border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">
                    {new Date(saved.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {saved.prompt.slice(0, 80)}{saved.prompt.length > 80 ? "…" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {parsedDrafts.slice(0, 3).map((d) => (
                      <Badge key={d.platform} variant="secondary" className="text-xs">
                        {PLATFORM_LABELS[d.platform as Platform]?.split(" ")[0] ?? d.platform}
                      </Badge>
                    ))}
                    {parsedDrafts.length > 3 && (
                      <Badge variant="secondary" className="text-xs">+{parsedDrafts.length - 3}</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {drafts.length === 0 && savedDrafts.length === 0 && !generating && (
        <Card className="p-10 border-dashed border-gray-200 text-center">
          <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Generate your first AI draft above</p>
        </Card>
      )}
    </div>
  );
}
