"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, Clock, Plus, Image as ImageIcon, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";

interface Profile {
  id: string;
  name: string;
  slug: string;
  oauth_tokens: { platform: string }[];
}

interface AiDraft {
  platform: string;
  content: string;
}

interface UploadedMedia {
  url: string;
  name: string;
  type: string;
}

export default function ComposePage() {
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [content, setContent] = useState(searchParams.get("content") ?? "");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDrafts, setAiDrafts] = useState<AiDraft[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/dashboard/profiles")
      .then((r) => r.json())
      .then((d: { profiles: Profile[] }) => {
        setProfiles(d.profiles ?? []);
        if (d.profiles?.length > 0) {
          const preProfile = searchParams.get("profileId");
          const first = preProfile ?? d.profiles[0].id;
          setSelectedProfile(first);
          const p = d.profiles.find((x) => x.id === first);
          if (p) {
            const connected = p.oauth_tokens.map((t) => t.platform as Platform);
            setSelectedPlatforms(connected);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const activeProfile = profiles.find((p) => p.id === selectedProfile);
  const connectedPlatforms = activeProfile?.oauth_tokens.map((t) => t.platform as Platform) ?? [];

  function handleProfileChange(id: string) {
    setSelectedProfile(id);
    const p = profiles.find((x) => x.id === id);
    if (p) setSelectedPlatforms(p.oauth_tokens.map((t) => t.platform as Platform));
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (media.length + files.length > 4) {
      toast.error("Max 4 media files per post");
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok) { toast.error(data.error ?? "Upload failed"); continue; }
        setMedia((prev) => [...prev, { url: data.url!, name: file.name, type: file.type }]);
      }
      toast.success("Media uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(url: string) {
    setMedia((prev) => prev.filter((m) => m.url !== url));
  }

  async function generateAiDrafts() {
    if (!aiPrompt.trim()) { toast.error("Enter a topic to generate drafts"); return; }
    if (!selectedProfile) { toast.error("Select a profile first"); return; }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, platforms: selectedPlatforms, profileId: selectedProfile }),
      });
      const data = await res.json() as { drafts?: AiDraft[]; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      setAiDrafts(data.drafts ?? []);
      if (data.drafts?.[0]) setContent(data.drafts[0].content);
      toast.success("AI drafts generated!");
    } catch {
      toast.error("Generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit() {
    if (!content.trim()) { toast.error("Write something first"); return; }
    if (!selectedProfile) { toast.error("Select a profile"); return; }
    if (selectedPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    if (scheduled && !scheduledFor) { toast.error("Set a schedule time"); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        post: content,
        platforms: selectedPlatforms,
        profileId: selectedProfile,
        mediaUrls: media.map((m) => m.url),
      };
      if (scheduled) body.scheduledFor = new Date(scheduledFor).toISOString();

      const res = await fetch("/api/dashboard/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Post failed"); return; }
      setSuccess(true);
      toast.success(scheduled ? "Post scheduled!" : "Post queued for distribution!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-bold text-black mb-2">Compose</h1>
        <Card className="p-10 border-dashed border-gray-200 text-center mt-6">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="font-semibold text-black mb-2">No profiles yet</h3>
          <p className="text-gray-500 text-sm mb-5">Create a profile before composing a post.</p>
          <Button asChild><Link href="/dashboard/profiles/new">Create a profile</Link></Button>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-6 max-w-xl">
        <Card className="p-8 border-green-200 bg-green-50 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="font-bold text-green-900 text-lg mb-2">{scheduled ? "Post scheduled!" : "Post queued!"}</h2>
          <p className="text-green-700 text-sm mb-6">
            {scheduled ? "Your post is scheduled for distribution." : "Fanout is distributing your post to all selected platforms."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { setSuccess(false); setContent(""); setAiDrafts([]); setMedia([]); }}>
              Compose another
            </Button>
            <Button asChild className="bg-black text-white hover:bg-gray-800">
              <Link href="/dashboard">View overview</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Compose</h1>
        <p className="text-gray-500 text-sm mt-0.5">Write once. Post everywhere.</p>
      </div>

      <div className="space-y-6">
        {/* Profile selector */}
        <div>
          <label className="text-sm font-medium text-black mb-2 block">Profile</label>
          <Select value={selectedProfile} onValueChange={handleProfileChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a profile" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <div>
          <label className="text-sm font-medium text-black mb-2 block">Post content</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to post?"
            className="min-h-32 text-sm"
          />
          <div className="text-xs text-gray-400 mt-1 text-right">{content.length} chars</div>
        </div>

        {/* Media upload */}
        <div>
          <label className="text-sm font-medium text-black mb-2 block">Media (optional)</label>

          {media.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {media.map((m) => (
                <div key={m.url} className="relative group">
                  {m.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.name}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-1">
                      <ImageIcon className="w-6 h-6 text-gray-400" aria-hidden="true" />
                      <span className="text-xs text-gray-400 truncate px-1 w-full text-center">
                        {m.name.length > 10 ? m.name.slice(0, 10) + "…" : m.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(m.url)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            disabled={uploading || media.length >= 4}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
            ) : (
              <><ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> Add media</>
            )}
          </Button>
          <p className="text-xs text-gray-400 mt-1.5">Up to 4 files · JPG, PNG, GIF, WebP, MP4 · Max 50MB each</p>
        </div>

        {/* Platform selector */}
        <div>
          <label className="text-sm font-medium text-black mb-2 block">Platforms</label>
          {connectedPlatforms.length === 0 ? (
            <p className="text-sm text-gray-400">
              No platforms connected.{" "}
              <Link href={`/dashboard/profiles/${selectedProfile}`} className="text-black underline">
                Connect platforms →
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_PLATFORMS.map((platform) => {
                const isConnected = connectedPlatforms.includes(platform);
                const isSelected = selectedPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    disabled={!isConnected}
                    onClick={() => isConnected && togglePlatform(platform)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      !isConnected
                        ? "border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50"
                        : isSelected
                        ? "border-black bg-black text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* AI toggle */}
        <div className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-black">AI platform variants</span>
            </div>
            <button
              type="button"
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${aiEnabled ? "bg-black" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${aiEnabled ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
          {aiEnabled && (
            <div className="space-y-3">
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your post topic or paste your draft..."
                className="min-h-20 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateAiDrafts}
                disabled={aiLoading}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {aiLoading ? "Generating..." : "Generate variants"}
              </Button>
              {aiDrafts.length > 0 && (
                <div className="space-y-2 mt-3">
                  {aiDrafts.map((draft) => (
                    <div key={draft.platform} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="outline" className="text-xs">{PLATFORM_LABELS[draft.platform as Platform] ?? draft.platform}</Badge>
                        <button
                          type="button"
                          className="text-xs text-black underline"
                          onClick={() => setContent(draft.content)}
                        >
                          Use this
                        </button>
                      </div>
                      <p className="text-xs text-gray-600">{draft.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Schedule toggle */}
        <div className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-black">Schedule for later</span>
            </div>
            <button
              type="button"
              onClick={() => setScheduled(!scheduled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${scheduled ? "bg-black" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${scheduled ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
          {scheduled && (
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
            />
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !content.trim() || selectedPlatforms.length === 0}
          className="w-full bg-black text-white hover:bg-gray-800 h-11"
        >
          {submitting ? "Posting..." : scheduled ? "Schedule post" : "Post now"}
        </Button>
      </div>
    </div>
  );
}
