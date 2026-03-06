import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

// Agency status endpoint — matches NuStack Agency Engine EngineStatusResponse shape.
// Called by agency engine refresh route via EngineClient.getEngineStatus().
// Auth: Bearer AGENCY_SNAPSHOT_SECRET

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.AGENCY_SNAPSHOT_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 30);

    const [
      totalOrgsResult,
      newOrgs30dResult,
      postsToday,
      postsThisWeek,
      postsThisMonth,
      postsFailedToday,
      activeSubscriptions,
      tokenData,
    ] = await Promise.all([
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      supabase.from('post_results').select('id', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', todayStart.toISOString()),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('oauth_tokens').select('platform').eq('is_valid', true),
    ]);

    const platformsConnected = [...new Set((tokenData.data ?? []).map((t: { platform: string }) => t.platform))];
    const integrations: Record<string, { configured: boolean; status: string }> = {};
    for (const platform of ['twitter', 'linkedin', 'instagram', 'facebook', 'reddit', 'tiktok', 'youtube', 'pinterest', 'threads']) {
      integrations[platform] = {
        configured: platformsConnected.includes(platform),
        status: platformsConnected.includes(platform) ? 'connected' : 'not_configured',
      };
    }

    // Map Fanout metrics to EngineStatusResponse shape
    // Fanout uses orgs/posts instead of patients/leads — map best-fit fields
    const response = {
      engine: 'fanout',
      practice: 'Fanout — Social Media API',
      generatedAt: now.toISOString(),

      // orgs = "leads" (new signups)
      leads: {
        today: 0,
        thisWeek: 0,
        thisMonth: newOrgs30dResult.count ?? 0,
        pending: 0,
        avgResponseSeconds: null,
      },

      // posts = "appointments" (scheduled/sent posts)
      appointments: {
        today: postsToday.count ?? 0,
        thisWeek: postsThisWeek.count ?? 0,
        confirmed: postsThisMonth.count ?? 0,
        noShows: postsFailedToday.count ?? 0,
        cancellations: 0,
      },

      // orgs_total = "patients total", new orgs = "new30d"
      patients: {
        total: totalOrgsResult.count ?? 0,
        active: activeSubscriptions.count ?? 0,
        new30d: newOrgs30dResult.count ?? 0,
      },

      aiActions: {
        pending: 0,
        approvedToday: 0,
        rejectedToday: 0,
        totalToday: 0,
      },

      outreach: {
        sentToday: postsToday.count ?? 0,
        deliveredToday: (postsToday.count ?? 0) - (postsFailedToday.count ?? 0),
        failedToday: postsFailedToday.count ?? 0,
        activeSequences: 0,
      },

      integrations,

      health: {
        dbOk: true,
        lastCronRun: null,
        cronHealthy: true,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: 'Status check failed', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 },
    );
  }
}
