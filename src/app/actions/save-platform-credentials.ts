"use server";

import { auth } from "@clerk/nextjs/server";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

interface SaveResult {
  success: boolean;
  error?: string;
}

async function upsertVercelEnv(key: string, value: string): Promise<void> {
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
  const baseUrl = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`;

  // Try to create first
  const createRes = await fetch(`${baseUrl}${teamParam}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview"],
    }),
  });

  if (createRes.status === 409) {
    // Already exists — fetch env id and update
    const listRes = await fetch(`${baseUrl}${teamParam}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    const listData = await listRes.json() as { envs: Array<{ id: string; key: string }> };
    const existing = listData.envs.find((e) => e.key === key);
    if (existing) {
      await fetch(`${baseUrl}/${existing.id}${teamParam}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });
    }
  } else if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Vercel API error for ${key}: ${err}`);
  }
}

export async function savePlatformCredentials(
  platform: string,
  credentials: Record<string, string>
): Promise<SaveResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      error: "VERCEL_TOKEN or VERCEL_PROJECT_ID not configured on this server",
    };
  }

  try {
    await Promise.all(
      Object.entries(credentials)
        .filter(([, v]) => v.trim() !== "")
        .map(([key, value]) => upsertVercelEnv(key, value))
    );
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
