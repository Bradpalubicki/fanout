import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const metadata = { title: "Profiles — Fanout" };

export default async function ProfilesPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, oauth_tokens(platform)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-black">Profiles</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage client profiles and connected platforms</p>
        </div>
        <Button className="bg-black text-white hover:bg-gray-800" asChild>
          <Link href="/dashboard/profiles/new">
            <Plus className="w-4 h-4 mr-2" /> New profile
          </Link>
        </Button>
      </div>

      {(profiles ?? []).length === 0 ? (
        <Card className="p-12 border-dashed border-gray-200 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="font-semibold text-black mb-2">No profiles yet</h3>
          <p className="text-gray-500 text-sm mb-6">Create a profile for each client to manage their social accounts.</p>
          <Button asChild>
            <Link href="/dashboard/profiles/new">Create your first profile</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(profiles ?? []).map((profile) => {
            const platforms = profile.oauth_tokens as { platform: string }[] ?? [];
            return (
              <Link key={profile.id} href={`/dashboard/profiles/${profile.id}`}>
                <Card className="p-5 border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold">
                        {profile.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {platforms.length} platform{platforms.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-black mb-1">{profile.name}</h3>
                  <p className="text-gray-400 text-xs mb-3">{profile.slug}</p>
                  <div className="flex flex-wrap gap-1">
                    {platforms.slice(0, 5).map((t) => (
                      <Badge key={t.platform} variant="secondary" className="text-xs py-0">
                        {t.platform}
                      </Badge>
                    ))}
                    {platforms.length > 5 && (
                      <Badge variant="secondary" className="text-xs py-0">
                        +{platforms.length - 5}
                      </Badge>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
