import { NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

// Agency snapshot endpoint — called by NuStack Agency Engine to pull live Fanout metrics.
// Auth: Bearer token matching AGENCY_SNAPSHOT_SECRET env var.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    // Run all queries in parallel
    const [
      totalOrgsResult,
      newOrgs30dResult,
      totalProfilesResult,
      postsToday,
      postsThisWeek,
      postsTotal,
      postsFailedToday,
      activeSubscriptions,
    ] = await Promise.all([
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('post_results').select('id', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', todayStart.toISOString()),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    // Platform health — check if OAuth tokens exist per platform
    const cronHealthThreshold = new Date(now.getTime() - 15 * 60 * 1000);
    const [{ data: tokenData }, { data: lastProcessed }] = await Promise.all([
      supabase.from('oauth_tokens').select('platform').eq('is_valid', true),
      supabase.from('post_results').select('created_at').order('created_at', { ascending: false }).limit(1),
    ]);

    const platformsConnected = [...new Set((tokenData ?? []).map(t => t.platform))];
    const platformHealth: Record<string, { status: 'ok' | 'error' | 'unknown' }> = {};
    for (const platform of ['twitter', 'linkedin', 'instagram', 'facebook', 'reddit', 'tiktok', 'youtube', 'pinterest', 'threads']) {
      platformHealth[platform] = {
        status: platformsConnected.includes(platform) ? 'ok' : 'unknown',
      };
    }

    const snapshot = {
      timestamp: now.toISOString(),
      site_up: true,

      // Users / Organizations
      orgs_total: totalOrgsResult.count ?? 0,
      orgs_new_30d: newOrgs30dResult.count ?? 0,
      profiles_total: totalProfilesResult.count ?? 0,

      // Posts / Activity
      posts_today: postsToday.count ?? 0,
      posts_this_week: postsThisWeek.count ?? 0,
      posts_total: postsTotal.count ?? 0,
      posts_failed_today: postsFailedToday.count ?? 0,

      // Billing
      active_subscriptions: activeSubscriptions.count ?? 0,

      // Platform OAuth health
      platforms_connected: platformsConnected,
      platform_health: platformHealth,

      // Cron / system health — computed from last post_result activity
      cron_healthy: lastProcessed?.[0]?.created_at
        ? new Date(lastProcessed[0].created_at) > cronHealthThreshold
        : false,
      last_cron_run: lastProcessed?.[0]?.created_at ?? null,

      // Meta for agency dashboard display
      engine_type: 'fanout',
      engine_version: '1.0.0',
    };

    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: 'Snapshot failed', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
