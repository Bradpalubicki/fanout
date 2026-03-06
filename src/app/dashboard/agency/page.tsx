import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AgencyOrgCard } from "@/components/dashboard/agency-org-card";

export const metadata = { title: "Agency Dashboard — Fanout" };

interface OrgSubscription {
  org_id: string;
  plan_key: string | null;
  status: string | null;
  trial_expires_at: string | null;
  activated_at: string | null;
}

interface Profile {
  id: string;
  org_id: string;
  name: string;
  slug: string;
}

interface OauthToken {
  profile_id: string;
  platform: string;
}

interface OrgStat extends OrgSubscription {
  profileCount: number;
  platformCount: number;
  profiles: Profile[];
}

export default async function AgencyPage() {
  const { userId } = await auth();
  const user = await currentUser();

  const isNuStack = user?.emailAddresses.some((e) =>
    e.emailAddress.includes("@nustack.digital")
  );

  if (!userId || !isNuStack) {
    redirect("/dashboard");
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: subscriptions } = await supabaseAdmin
    .from("org_subscriptions")
    .select("org_id, plan_key, status, trial_expires_at, activated_at")
    .order("activated_at", { ascending: false });

  const orgIds = (subscriptions as OrgSubscription[] | null)?.map((s) => s.org_id) ?? [];

  const [profilesResult] = await Promise.all([
    orgIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id, org_id, name, slug")
          .in("org_id", orgIds)
      : Promise.resolve({ data: [] as Profile[] }),
    Promise.resolve({ data: [] as OauthToken[] }),
  ]);

  const profiles = profilesResult.data as Profile[] ?? [];

  // Fetch tokens for all profiles
  const profileIds = profiles.map((p) => p.id);
  const { data: tokens } = profileIds.length
    ? await supabaseAdmin
        .from("oauth_tokens")
        .select("profile_id, platform")
        .in("profile_id", profileIds)
    : { data: [] as OauthToken[] };

  const allTokens = tokens as OauthToken[] ?? [];

  const orgStats: OrgStat[] = (subscriptions as OrgSubscription[] | null)?.map((sub) => {
    const orgProfiles = profiles.filter((p) => p.org_id === sub.org_id);
    const orgProfileIds = new Set(orgProfiles.map((p) => p.id));
    const orgTokens = allTokens.filter((t) => orgProfileIds.has(t.profile_id));
    const uniquePlatforms = new Set(orgTokens.map((t) => t.platform));
    return {
      ...sub,
      profileCount: orgProfiles.length,
      platformCount: uniquePlatforms.size,
      profiles: orgProfiles,
    };
  }) ?? [];

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black">Agency Dashboard</h1>
            <p className="text-gray-500 text-sm">
              NuStack staff only — manage client accounts and platform connections
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
          <div>
            <div className="text-2xl font-black text-black">{orgStats.length}</div>
            <div className="text-xs text-gray-400">Organizations</div>
          </div>
          <div>
            <div className="text-2xl font-black text-black">{profiles.length}</div>
            <div className="text-xs text-gray-400">Total profiles</div>
          </div>
          <div>
            <div className="text-2xl font-black text-black">{allTokens.length}</div>
            <div className="text-xs text-gray-400">OAuth connections</div>
          </div>
          <div>
            <div className="text-2xl font-black text-black">
              {orgStats.filter((o) => o.status === "active").length}
            </div>
            <div className="text-xs text-gray-400">Active plans</div>
          </div>
        </div>
      </div>

      {/* Org list */}
      <div className="space-y-3">
        {orgStats.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No client organizations yet
          </div>
        ) : (
          orgStats.map((org) => <AgencyOrgCard key={org.org_id} org={org} />)
        )}
      </div>
    </div>
  );
}
