import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/agency/onboarding-status?email=<email>
// Returns onboarding state for a client. Never returns OAuth tokens or secrets.
// Auth: x-fanout-agency-key header

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const agencyKey = process.env.FANOUT_AGENCY_KEY;
  const incoming = request.headers.get("x-fanout-agency-key");

  if (!agencyKey || incoming !== agencyKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  // Look up user by email in Clerk
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return NextResponse.json({ error: "Clerk not configured" }, { status: 500 });
  }

  let clerkUserId: string | null = null;
  try {
    const findRes = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    const findData = (await findRes.json()) as Array<{ id: string }>;
    if (Array.isArray(findData) && findData.length > 0) {
      clerkUserId = findData[0].id ?? null;
    }
  } catch {
    // Fall through — user simply not found
  }

  if (!clerkUserId) {
    return NextResponse.json({
      found: false,
      onboarding_complete: false,
      platforms_connected: [],
      profile_count: 0,
      last_post_at: null,
    });
  }

  // Look up profiles for this user (org_id matches Clerk userId for direct users)
  // Fanout stores org_id on profiles — for direct signups org_id = Clerk orgId.
  // Agency-launched users are tied to user_id in onboarding_sessions.
  const { data: session } = await supabase
    .from("onboarding_sessions")
    .select("org_id")
    .eq("user_id", clerkUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const orgId = session?.org_id ?? clerkUserId;

  const [profilesRes, tokensRes, postsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, onboarding_complete, onboarding_completed_at, client_type")
      .eq("org_id", orgId),
    supabase
      .from("oauth_tokens")
      .select("platform")
      .in(
        "profile_id",
        (await supabase.from("profiles").select("id").eq("org_id", orgId)).data?.map(
          (p: { id: string }) => p.id
        ) ?? []
      )
      .eq("is_valid", true),
    supabase
      .from("posts")
      .select("created_at")
      .in(
        "profile_id",
        (await supabase.from("profiles").select("id").eq("org_id", orgId)).data?.map(
          (p: { id: string }) => p.id
        ) ?? []
      )
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const profiles = profilesRes.data ?? [];
  const onboarding_complete = profiles.some((p: { onboarding_complete: boolean }) => p.onboarding_complete);
  const platforms_connected = [
    ...new Set(
      (tokensRes.data ?? []).map((t: { platform: string }) => t.platform)
    ),
  ];
  const last_post_at =
    (postsRes.data ?? []).length > 0
      ? (postsRes.data as Array<{ created_at: string }>)[0].created_at
      : null;

  return NextResponse.json({
    found: true,
    onboarding_complete,
    platforms_connected,
    profile_count: profiles.length,
    last_post_at,
  });
}
