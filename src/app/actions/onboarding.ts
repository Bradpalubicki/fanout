"use server";

import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

/**
 * Mark onboarding complete for the calling user's profile.
 * Verifies ownership by matching the profile's org_id to the current Clerk orgId.
 */
export async function markOnboardingComplete(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const { orgId } = await auth();
  if (!orgId) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership — profile must belong to caller's org
  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, org_id")
    .eq("id", profileId)
    .eq("org_id", orgId)
    .single();

  if (fetchErr || !profile) {
    return { success: false, error: "Profile not found or access denied" };
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateErr) {
    return { success: false, error: "Failed to update profile" };
  }

  return { success: true };
}
