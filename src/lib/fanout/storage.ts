import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FanoutJob, FanoutEvent } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: SupabaseClient<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): SupabaseClient<any> {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _client
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: SupabaseClient<any> = new Proxy({} as SupabaseClient<any>, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(_t, prop: string) { return (getClient() as any)[prop] }
})

export async function saveFanoutJob(job: FanoutJob): Promise<void> {
  const { error } = await supabase.from('fanout_jobs').insert({
    id: job.id,
    type: job.type,
    status: job.status,
    agency_id: job.context.agencyId,
    client_id: job.context.clientId,
    client_name: job.context.clientName,
    website: job.context.website,
    vertical: job.context.vertical,
    city: job.context.city,
    audit_score: job.context.auditScore,
    compliance_risk: job.context.complianceRisk,
    source_engine: job.sourceEngine,
    source_id: job.sourceId,
    platforms: job.platforms,
    posts: job.posts,
    retry_count: job.retryCount,
    scheduled_at: job.scheduledAt,
    published_at: job.publishedAt,
    failed_at: job.failedAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  });
  if (error) throw error;
}

export async function updateFanoutJob(
  jobId: string,
  patch: Partial<FanoutJob>
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.status !== undefined) update.status = patch.status;
  if (patch.posts !== undefined) update.posts = patch.posts;
  if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;
  if (patch.publishedAt !== undefined) update.published_at = patch.publishedAt;
  if (patch.failedAt !== undefined) update.failed_at = patch.failedAt;
  if (patch.retryCount !== undefined) update.retry_count = patch.retryCount;

  const { error } = await supabase
    .from('fanout_jobs')
    .update(update)
    .eq('id', jobId);
  if (error) throw error;
}

export async function getFanoutJob(jobId: string): Promise<FanoutJob | null> {
  const { data, error } = await supabase
    .from('fanout_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    type: data.type,
    status: data.status,
    context: {
      agencyId: data.agency_id,
      clientId: data.client_id,
      clientName: data.client_name,
      website: data.website,
      vertical: data.vertical,
      city: data.city,
      auditScore: data.audit_score,
      complianceRisk: data.compliance_risk,
    },
    sourceEngine: data.source_engine,
    sourceId: data.source_id,
    platforms: data.platforms || [],
    posts: data.posts || [],
    scheduledAt: data.scheduled_at,
    publishedAt: data.published_at,
    failedAt: data.failed_at,
    retryCount: data.retry_count || 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getFanoutJobsByClient(clientId: string): Promise<FanoutJob[]> {
  const { data, error } = await supabase
    .from('fanout_jobs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    context: {
      agencyId: d.agency_id,
      clientId: d.client_id,
      clientName: d.client_name,
      website: d.website,
      vertical: d.vertical,
      city: d.city,
      auditScore: d.audit_score,
      complianceRisk: d.compliance_risk,
    },
    sourceEngine: d.source_engine,
    sourceId: d.source_id,
    platforms: d.platforms || [],
    posts: d.posts || [],
    scheduledAt: d.scheduled_at,
    publishedAt: d.published_at,
    failedAt: d.failed_at,
    retryCount: d.retry_count || 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function saveFanoutEvents(events: FanoutEvent[]): Promise<void> {
  const rows = events.map((e) => ({
    id: e.id,
    job_id: e.jobId,
    client_id: e.clientId,
    event_type: e.eventType,
    message: e.message,
    metadata: e.metadata || {},
    created_at: e.createdAt,
  }));

  const { error } = await supabase.from('fanout_events').insert(rows);
  if (error) throw error;
}

export async function getFanoutEventsByClient(clientId: string): Promise<FanoutEvent[]> {
  const { data, error } = await supabase
    .from('fanout_events')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    jobId: d.job_id,
    clientId: d.client_id,
    eventType: d.event_type,
    message: d.message,
    createdAt: d.created_at,
    metadata: d.metadata,
  }));
}
