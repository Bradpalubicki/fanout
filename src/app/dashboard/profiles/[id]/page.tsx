import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import { CopyButton } from "@/components/dashboard/copy-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Profile ${id} — Fanout` };
}

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/dashboard");

  const { id } = await params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, oauth_tokens(platform, platform_username, expires_at, created_at)")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (!profile) redirect("/dashboard/profiles");

  const connectedTokens = profile.oauth_tokens as {
    platform: string;
    platform_username: string | null;
    expires_at: string | null;
    created_at: string;
  }[];

  const connectedPlatforms = connectedTokens.map((t) => t.platform);

  const { data: recentPosts } = await supabase
    .from("posts")
    .select("id, content, platforms, status, created_at")
    .eq("profile_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard/profiles" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Profiles
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {(profile.name as string).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black">{profile.name as string}</h1>
            <p className="text-gray-400 text-sm">{profile.slug as string}</p>
          </div>
        </div>
      </div>

      {/* API Key */}
      <Card className="p-5 border-gray-100 mb-6">
        <h2 className="font-semibold text-black mb-3">API Key</h2>
        <p className="text-sm text-gray-500 mb-3">
          Use this key in the <code className="bg-gray-100 px-1 rounded">Authorization: Bearer</code> header.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono">
            sk_••••••••••••••••••••••••••••••••
          </code>
          <CopyButton text={profile.id as string} label="Copy profile ID" />
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings?tab=keys">Regenerate</Link>
          </Button>
        </div>
      </Card>

      {/* Connected Platforms */}
      <Card className="p-5 border-gray-100 mb-6">
        <h2 className="font-semibold text-black mb-4">Connected Platforms</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUPPORTED_PLATFORMS.map((platform) => {
            const token = connectedTokens.find((t) => t.platform === platform);
            const isConnected = connectedPlatforms.includes(platform);
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
                  <form action={`/api/v1/platforms/${platform}?profileId=${id}`} method="DELETE">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs text-red-600 hover:text-red-700 border-red-200"
                      formAction={`/api/v1/platforms/${platform}?profileId=${id}`}
                    >
                      Disconnect
                    </Button>
                  </form>
                ) : (
                  <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                    <Link href={`/api/oauth/${platform}/authorize?profileId=${id}`}>
                      Connect
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Posts */}
      <Card className="p-5 border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-black">Recent Posts</h2>
          <Link href="/dashboard/compose" className="text-sm text-gray-500 hover:text-black">
            + Compose
          </Link>
        </div>
        {(recentPosts ?? []).length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No posts yet for this profile.
          </div>
        ) : (
          <div className="space-y-3">
            {(recentPosts ?? []).map((post) => (
              <div key={post.id} className="flex items-start justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1 mb-1">
                    {(post.platforms as string[]).slice(0, 4).map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs py-0">
                        {PLATFORM_LABELS[p as Platform]?.split(" ")[0] ?? p}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 truncate">{post.content as string}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {post.status === "posted" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {post.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
                  {post.status === "pending" && <Clock className="w-4 h-4 text-yellow-500" />}
                  <span className="text-xs text-gray-400 capitalize">{post.status as string}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
