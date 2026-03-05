import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle2, XCircle } from "lucide-react";
import { SUPPORTED_PLATFORMS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import { AnalyticsChart } from "@/components/dashboard/analytics-chart";

export const metadata = { title: "Analytics — Fanout" };

export default async function AnalyticsPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("org_id", orgId);

  const profileIds = (profiles ?? []).map((p) => p.id);

  const { data: posts } = profileIds.length
    ? await supabase
        .from("posts")
        .select("id, content, platforms, status, created_at, profiles(name)")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const postIds = (posts ?? []).map((p) => p.id);

  const { data: results } = postIds.length
    ? await supabase
        .from("post_results")
        .select("post_id, platform, status, posted_at")
        .in("post_id", postIds)
    : { data: [] };

  const allResults = results ?? [];
  const totalPosts = (posts ?? []).length;
  const successCount = allResults.filter((r) => r.status === "success").length;
  const successRate = allResults.length > 0 ? Math.round((successCount / allResults.length) * 100) : 0;
  const activePlatforms = [...new Set(allResults.map((r) => r.platform))].length;

  const chartData = SUPPORTED_PLATFORMS.map((p) => ({
    platform: p === "twitter" ? "X" : PLATFORM_LABELS[p].split(" ")[0],
    success: allResults.filter((r) => r.platform === p && r.status === "success").length,
    failed: allResults.filter((r) => r.platform === p && r.status === "failed").length,
  }));

  const stats = [
    { label: "Total posts", value: totalPosts },
    { label: "Success rate", value: totalPosts ? `${successRate}%` : "—" },
    { label: "Platforms active", value: activePlatforms },
    { label: "Profiles", value: (profiles ?? []).length },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Post performance across all profiles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 border-gray-100">
            <div className="text-3xl font-black text-black mb-1">{s.value}</div>
            <div className="text-gray-500 text-sm">{s.label}</div>
          </Card>
        ))}
      </div>

      {totalPosts === 0 ? (
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-black mb-2">No analytics yet</h3>
          <p className="text-gray-500 text-sm">Analytics appear after your first post.</p>
        </Card>
      ) : (
        <>
          {/* Chart */}
          <Card className="p-5 border-gray-100 mb-6">
            <h2 className="font-semibold text-black mb-4">Posts per platform</h2>
            <AnalyticsChart data={chartData} />
          </Card>

          {/* Recent posts table */}
          <Card className="border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-black">Recent posts</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {(posts ?? []).slice(0, 20).map((post) => {
                const postResults = allResults.filter((r) => r.post_id === post.id);
                const postSuccess = postResults.filter((r) => r.status === "success").length;
                const postFailed = postResults.filter((r) => r.status === "failed").length;
                return (
                  <div key={post.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 font-medium">
                          {((post.profiles as unknown) as { name: string } | null)?.name ?? "Unknown"}
                        </span>
                        <div className="flex gap-1">
                          {(post.platforms as string[]).slice(0, 3).map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs py-0 h-4">
                              {PLATFORM_LABELS[p as Platform]?.split(" ")[0] ?? p}
                            </Badge>
                          ))}
                          {(post.platforms as string[]).length > 3 && (
                            <Badge variant="secondary" className="text-xs py-0 h-4">
                              +{(post.platforms as string[]).length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 truncate max-w-sm">
                        {post.content as string}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {postResults.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" /> {postSuccess}
                          </span>
                          {postFailed > 0 && (
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="w-3 h-3" /> {postFailed}
                            </span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(post.created_at as string).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
