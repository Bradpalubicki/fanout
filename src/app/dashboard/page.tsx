import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { OrganizationList } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PenSquare, Plus, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";

export const metadata = { title: "Overview — Fanout" };

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!orgId) {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-bold text-black mb-2">Select your organization</h1>
        <p className="text-gray-500 text-sm mb-6">Choose an existing organization or create one to get started with Fanout.</p>
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" afterCreateOrganizationUrl="/dashboard" />
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

  const { data: recentPosts } = profileIds.length
    ? await supabase
        .from("posts")
        .select("id, content, platforms, status, created_at, profiles(name)")
        .in("profile_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: postResults } = profileIds.length
    ? await supabase
        .from("post_results")
        .select("status")
        .in(
          "post_id",
          (recentPosts ?? []).map((p) => p.id)
        )
    : { data: [] };

  const totalPosts = recentPosts?.length ?? 0;
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
            {(profiles ?? []).length} active profile{(profiles ?? []).length !== 1 ? "s" : ""} connected
          </p>
        </div>
        <Button className="bg-black text-white hover:bg-gray-800" asChild>
          <Link href="/dashboard/compose">
            <PenSquare className="w-4 h-4 mr-2" /> Compose post
          </Link>
        </Button>
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
            {(recentPosts ?? []).length === 0 ? (
              <Card className="p-8 border-dashed border-gray-200 text-center">
                <div className="text-gray-400 text-sm mb-3">No posts yet</div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/compose">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create your first post
                  </Link>
                </Button>
              </Card>
            ) : (
              (recentPosts ?? []).map((post) => (
                <Card key={post.id} className="p-4 border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-medium text-gray-500">
                          {((post.profiles as unknown) as { name: string } | null)?.name ?? "Unknown"}
                        </span>
                        <div className="flex gap-1">
                          {(post.platforms as string[]).slice(0, 4).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-xs py-0 px-1.5 h-5">
                              {p}
                            </Badge>
                          ))}
                          {(post.platforms as string[]).length > 4 && (
                            <Badge variant="outline" className="text-xs py-0 px-1.5 h-5">
                              +{(post.platforms as string[]).length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 truncate">{post.content}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {post.status === "posted" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {post.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
                      {post.status === "pending" && <Clock className="w-4 h-4 text-yellow-500" />}
                      <span className="text-xs text-gray-400 capitalize">{post.status as string}</span>
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
            <Link href="/dashboard/profiles/new" className="text-sm text-gray-500 hover:text-black">
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
              (profiles ?? []).map((profile) => (
                <Link key={profile.id} href={`/dashboard/profiles/${profile.id}`}>
                  <Card className="p-4 border-gray-100 hover:border-gray-300 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-sm text-black">{profile.name}</div>
                        <div className="text-xs text-gray-400">{profile.slug}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
