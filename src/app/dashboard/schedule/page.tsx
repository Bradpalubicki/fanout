import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus } from "lucide-react";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";
import { CancelPostButton } from "./cancel-button";

export const metadata = { title: "Schedule — Fanout" };

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` at ${time}`;
}

function WeekStrip({ postDates }: { postDates: string[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const postDayStrings = postDates.map((iso) => new Date(iso).toDateString());

  return (
    <div className="flex gap-2 mb-6">
      {days.map((d) => {
        const hasPost = postDayStrings.includes(d.toDateString());
        const isToday = d.toDateString() === new Date().toDateString();
        return (
          <div
            key={d.toDateString()}
            className={`flex-1 rounded-lg p-2 text-center text-xs ${
              isToday ? "bg-black text-white" : "bg-gray-50 text-gray-600"
            }`}
          >
            <div className="font-medium">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
            <div className="mt-0.5">{d.getDate()}</div>
            {hasPost && (
              <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${isToday ? "bg-white" : "bg-black"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function SchedulePage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("org_id", orgId);

  const profileIds = (profiles ?? []).map((p) => p.id);

  const { data: upcoming } = profileIds.length
    ? await supabase
        .from("posts")
        .select("id, content, platforms, scheduled_for, status, profiles(name)")
        .in("profile_id", profileIds)
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
    : { data: [] };

  const { data: past } = profileIds.length
    ? await supabase
        .from("posts")
        .select("id, content, platforms, scheduled_for, status, profiles(name)")
        .in("profile_id", profileIds)
        .not("scheduled_for", "is", null)
        .lt("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: false })
        .limit(10)
    : { data: [] };

  const upcomingDates = (upcoming ?? []).map((p) => p.scheduled_for as string);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-black">Schedule</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {(upcoming ?? []).length} post{(upcoming ?? []).length !== 1 ? "s" : ""} upcoming
          </p>
        </div>
        <Button className="bg-black text-white hover:bg-gray-800" asChild>
          <Link href="/dashboard/compose">
            <Plus className="w-4 h-4 mr-2" /> New post
          </Link>
        </Button>
      </div>

      <WeekStrip postDates={upcomingDates} />

      {(upcoming ?? []).length === 0 ? (
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-black mb-2">No scheduled posts</h3>
          <p className="text-gray-500 text-sm mb-6">Schedule a post to see it here.</p>
          <Button asChild>
            <Link href="/dashboard/compose">Compose a post</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          <h2 className="font-semibold text-black text-sm">Upcoming</h2>
          {(upcoming ?? []).map((post) => (
            <Card key={post.id} className="p-4 border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {((post.profiles as unknown) as { name: string } | null)?.name ?? "Unknown"}
                    </Badge>
                    {(post.platforms as string[]).slice(0, 5).map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">
                        {PLATFORM_LABELS[p as Platform] ?? p}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {(post.content as string).length > 120
                      ? post.content.toString().slice(0, 120) + "…"
                      : post.content as string}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-medium text-black">
                    {formatDate(post.scheduled_for as string)}
                  </div>
                  <Badge variant="outline" className="text-xs mt-1 capitalize">
                    {post.status as string}
                  </Badge>
                  {post.status === "pending" && (
                    <div className="mt-1">
                      <CancelPostButton postId={post.id} />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(past ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-black text-sm text-gray-400">Past</h2>
          {(past ?? []).map((post) => (
            <Card key={post.id} className="p-4 border-gray-100 opacity-60">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {((post.profiles as unknown) as { name: string } | null)?.name ?? "Unknown"}
                    </Badge>
                    {(post.platforms as string[]).slice(0, 5).map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">
                        {PLATFORM_LABELS[p as Platform] ?? p}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-1">
                    {(post.content as string).length > 100
                      ? post.content.toString().slice(0, 100) + "…"
                      : post.content as string}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-gray-400">
                    {new Date(post.scheduled_for as string).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs mt-1 capitalize ${
                      post.status === "posted" ? "border-green-200 text-green-700" : "border-red-200 text-red-700"
                    }`}
                  >
                    {post.status as string}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
