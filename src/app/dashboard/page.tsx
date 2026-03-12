import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { OrganizationList } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkTokenHealth } from "@/app/actions/check-token-health";
import {
  PenSquare,
  Plus,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Plug,
  ArrowRight,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";

export const metadata = { title: "Overview — Fanout" };

const PLATFORM_DOTS: Record<string, string> = {
  linkedin: "bg-blue-700",
  twitter: "bg-black",
  facebook: "bg-blue-600",
  instagram: "bg-pink-600",
  reddit: "bg-orange-500",
  pinterest: "bg-red-600",
  youtube: "bg-red-500",
  tiktok: "bg-gray-900",
  threads: "bg-gray-800",
};

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!orgId) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-bold text-black mb-2">Select your organization</h1>
        <p className="text-gray-500 text-sm mb-6">
          Choose an existing organization or create one to get started with Fanout.
        </p>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          afterCreateOrganizationUrl="/dashboard"
        />
      </div>
    );
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, slug")
    .eq("org_id", orgId)
    .limit(10);

  // Redirect new users with 0 profiles to onboarding setup
  if ((profiles ?? []).length === 0) {
    redirect("/dashboard/setup");
  }

  const profileIds = (profiles ?? []).map((p) => p.id);

  const [postsResult, , tokensResult] = await Promise.all([
    profileIds.length
      ? supabase
          .from("posts")
          .select("id, content, platforms, status, created_at, profiles(name)")
          .in("profile_id", profileIds)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    profileIds.length
      ? supabase
          .from("post_results")
          .select("status")
          .in(
            "post_id",
            [] as string[] // populated after posts query — we'll compute inline
          )
      : Promise.resolve({ data: [] }),
    profileIds.length
      ? supabase
          .from("oauth_tokens")
          .select("profile_id, platform, platform_username")
          .in("profile_id", profileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const recentPosts = postsResult.data ?? [];

  // Re-fetch post results with actual post IDs
  const { data: postResults } = recentPosts.length
    ? await supabase
        .from("post_results")
        .select("status")
        .in(
          "post_id",
          recentPosts.map((p) => p.id)
        )
    : { data: [] };

  const tokens = tokensResult.data ?? [];

  // Pending approvals count
  const { count: pendingApprovalCount } = profileIds.length
    ? await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .in('profile_id', profileIds)
        .eq('status', 'pending_approval')
    : { count: 0 }

  // Token health checks for all profiles
  const tokenHealthResults = await Promise.all(
    profileIds.map((pid) => checkTokenHealth(pid))
  );
  const allTokenHealth = tokenHealthResults.flat();
  const expiringTokens = allTokenHealth.filter((t) => t.status === "expiring_soon");
  const expiredTokens = allTokenHealth.filter((t) => t.status === "expired");

  // Platform connection stats
  const uniquePlatforms = new Set(tokens.map((t) => t.platform));
  const totalPlatformConnections = uniquePlatforms.size;
  const firstProfile = profiles?.[0];

  const totalPosts = recentPosts.length;
  const successCount = (postResults ?? []).filter((r) => r.status === "success").length;
  const failedCount = (postResults ?? []).filter((r) => r.status === "failed").length;
  const successRate =
    (postResults ?? []).length > 0
      ? Math.round((successCount / (postResults ?? []).length) * 100)
      : 100;

  const stats = [
    { label: "Profiles", value: (profiles ?? []).length, icon: Zap },
    { label: "Posts today", value: totalPosts, icon: CheckCircle2 },
    { label: "Success rate", value: `${successRate}%`, icon: CheckCircle2 },
    { label: "Failed", value: failedCount, icon: XCircle },
  ];

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-black">Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {(profiles ?? []).length} active profile{(profiles ?? []).length !== 1 ? "s" : ""}{" "}
            connected
          </p>
        </div>
        <Button className="bg-black text-white hover:bg-gray-800" asChild>
          <Link href="/dashboard/compose">
            <PenSquare className="w-4 h-4 mr-2" /> Compose post
          </Link>
        </Button>
      </div>

      {/* Token health warnings */}
      {expiredTokens.length > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {expiredTokens.length} platform token{expiredTokens.length !== 1 ? "s" : ""} expired
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {expiredTokens.map((t) => t.platform).join(", ")} — posts will fail until reconnected.
            </p>
          </div>
          {firstProfile && (
            <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-700 hover:bg-red-100 shrink-0" asChild>
              <Link href={`/dashboard/profiles/${firstProfile.id}`}>Reconnect →</Link>
            </Button>
          )}
        </div>
      )}
      {/* Zero-presence CTA — shown when no platforms connected */}
      {totalPlatformConnections === 0 && (
        <div className="mb-4 flex items-start gap-4 bg-gradient-to-r from-black to-gray-800 rounded-xl p-5 text-white">
          <Plug className="w-6 h-6 shrink-0 mt-0.5 text-gray-300" />
          <div className="flex-1">
            <p className="font-semibold text-white">No platforms connected yet</p>
            <p className="text-gray-300 text-sm mt-0.5">
              Use Quick Setup to create and connect all your social accounts in minutes.
            </p>
          </div>
          <Button size="sm" className="bg-white text-black hover:bg-gray-100 shrink-0" asChild>
            <Link href="/dashboard/setup/zero-presence">
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Get started <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}

      {/* Pending approvals banner */}
      {(pendingApprovalCount ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <ClipboardCheck className="w-5 h-5 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">
              {pendingApprovalCount} post{(pendingApprovalCount ?? 0) !== 1 ? 's' : ''} waiting for your approval
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">AI-generated content ready to review and publish</p>
          </div>
          <Button size="sm" variant="outline" className="text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-100 shrink-0" asChild>
            <Link href="/dashboard/approvals">Review →</Link>
          </Button>
        </div>
      )}

      {expiringTokens.length > 0 && expiredTokens.length === 0 && (
        <div className="mb-4 flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">
              {expiringTokens.length} platform token{expiringTokens.length !== 1 ? "s" : ""} expiring soon
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              {expiringTokens.map((t) => `${t.platform} (${t.daysLeft}d)`).join(", ")}
            </p>
          </div>
          {firstProfile && (
            <Button size="sm" variant="outline" className="text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-100 shrink-0" asChild>
              <Link href={`/dashboard/profiles/${firstProfile.id}`}>Reconnect →</Link>
            </Button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 border-gray-100">
            <div className="text-3xl font-black text-black mb-1">{s.value}</div>
            <div className="text-gray-500 text-sm">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Platform connections banner */}
      {totalPlatformConnections === 0 ? (
        <div className="mb-6 space-y-3">
          <Card className="p-6 border-dashed border-gray-300 bg-gray-50/50">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                  <Plug className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-black mb-0.5">Connect your platforms to start posting</h3>
                  <p className="text-sm text-gray-500">
                    0/9 platforms connected — Fanout needs OAuth access to post on your behalf
                  </p>
                </div>
              </div>
              {firstProfile && (
                <Button className="bg-black text-white hover:bg-gray-800 shrink-0" asChild>
                  <Link href={`/dashboard/profiles/${firstProfile.id}`}>
                    Connect Platforms <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </Button>
              )}
            </div>
          </Card>
          <Card className="p-4 border-blue-100 bg-blue-50/40">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Plug className="w-3.5 h-3.5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Step 1: Add platform API credentials</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Twitter/X, LinkedIn, Reddit, Pinterest, and YouTube are ready to connect — add your developer keys first.
                    Facebook/Instagram/Threads are pending Meta business verification.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-blue-300 text-blue-800 hover:bg-blue-100 shrink-0 text-xs" asChild>
                <Link href="/dashboard/settings/developer-apps">
                  Add credentials →
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-5 border-gray-100 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <Plug className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-black text-sm">
                  {totalPlatformConnections}/9 platform
                  {totalPlatformConnections !== 1 ? "s" : ""} connected
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  {Array.from(uniquePlatforms).map((p) => (
                    <div
                      key={p}
                      className={`w-2 h-2 rounded-full ${PLATFORM_DOTS[p] ?? "bg-gray-400"}`}
                      title={p}
                    />
                  ))}
                  {totalPlatformConnections < 9 && (
                    <span className="text-xs text-gray-400 ml-1">
                      + {9 - totalPlatformConnections} more available
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* mini progress */}
              <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black rounded-full"
                  style={{ width: `${(totalPlatformConnections / 9) * 100}%` }}
                />
              </div>
              {totalPlatformConnections < 9 && firstProfile && (
                <Button size="sm" variant="outline" className="text-xs shrink-0" asChild>
                  <Link href={`/dashboard/profiles/${firstProfile.id}`}>
                    Connect more →
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent posts */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-black">Recent posts</h2>
            <Link href="/dashboard/schedule" className="text-sm text-gray-500 hover:text-black">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {recentPosts.length === 0 ? (
              <Card className="p-8 border-dashed border-gray-200 text-center">
                <div className="text-gray-400 text-sm mb-3">No posts yet</div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/compose">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create your first post
                  </Link>
                </Button>
              </Card>
            ) : (
              recentPosts.map((post) => (
                <Card
                  key={post.id}
                  className="p-4 border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-gray-500">
                          {(
                            (post.profiles as unknown) as { name: string } | null
                          )?.name ?? "Unknown"}
                        </span>
                        <div className="flex gap-1">
                          {(post.platforms as string[]).slice(0, 4).map((p: string) => (
                            <Badge
                              key={p}
                              variant="outline"
                              className="text-xs py-0 px-1.5 h-5"
                            >
                              {p}
                            </Badge>
                          ))}
                          {(post.platforms as string[]).length > 4 && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 px-1.5 h-5"
                            >
                              +{(post.platforms as string[]).length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{post.content}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {post.status === "posted" && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {post.status === "failed" && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      {post.status === "pending" && (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                      <span className="text-xs text-gray-400 capitalize">
                        {post.status as string}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Profiles */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-black">Profiles</h2>
            <Link
              href="/dashboard/profiles/new"
              className="text-sm text-gray-500 hover:text-black"
            >
              + Add
            </Link>
          </div>
          <div className="space-y-2">
            {(profiles ?? []).length === 0 ? (
              <Card className="p-6 border-dashed border-gray-200 text-center">
                <div className="text-gray-400 text-sm mb-3">No profiles yet</div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/profiles/new">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create profile
                  </Link>
                </Button>
              </Card>
            ) : (
              (profiles ?? []).map((profile) => {
                const profileTokens = tokens.filter((t) => t.profile_id === profile.id);
                return (
                  <Link key={profile.id} href={`/dashboard/profiles/${profile.id}`}>
                    <Card className="p-4 border-gray-100 hover:border-gray-300 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {profile.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-black">{profile.name}</div>
                          <div className="text-xs text-gray-400">{profile.slug}</div>
                        </div>
                        {profileTokens.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0 border-green-200 text-green-700"
                          >
                            {profileTokens.length} platform{profileTokens.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
