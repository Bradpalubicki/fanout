import type { CreateFanoutJobInput, FanoutJob, FanoutEvent } from './types';
import { generateFanoutPosts, generateAuthorityCluster } from './generator';
import { saveFanoutJob, updateFanoutJob, saveFanoutEvents, getFanoutJob } from './storage';
import { publishToAyrshare } from './publisher';

export async function createFanoutJob(input: CreateFanoutJobInput): Promise<FanoutJob> {
  const job: FanoutJob = {
    id: crypto.randomUUID(),
    type: input.type,
    status: 'queued',
    context: input.context,
    sourceEngine: input.sourceEngine,
    sourceId: input.sourceId,
    platforms: input.platforms,
    posts: [],
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveFanoutJob(job);
  await emitFanoutEvent(job.id, input.context.clientId, 'queued', `Fanout job queued: ${job.type}`);

  return job;
}

export async function runFanoutPipeline(jobId: string): Promise<FanoutJob> {
  const job = await getFanoutJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  try {
    // Generate content
    await updateFanoutJob(jobId, { status: 'generating' });
    await emitFanoutEvent(jobId, job.context.clientId, 'generated', 'Generating platform-native content');

    let posts;
    if (job.type === 'authority_cluster') {
      const clusters = await generateAuthorityCluster(job.context, 'authority', jobId);
      posts = clusters.flatMap(c => c.posts);
    } else {
      const topic = deriveTopicFromJobType(job);
      posts = await generateFanoutPosts(job.context, job.platforms, topic, jobId);
    }

    await updateFanoutJob(jobId, { posts, status: 'review_required' });
    await emitFanoutEvent(jobId, job.context.clientId, 'generated', `${posts.length} posts generated — awaiting approval`);

    return { ...job, posts, status: 'review_required' };

  } catch (error) {
    await updateFanoutJob(jobId, { status: 'failed', failedAt: new Date().toISOString() });
    await emitFanoutEvent(jobId, job.context.clientId, 'failed', `Generation failed: ${error}`);
    throw error;
  }
}

export async function approveFanoutJob(jobId: string): Promise<void> {
  await updateFanoutJob(jobId, { status: 'approved' });
  const job = await getFanoutJob(jobId);
  if (job) {
    await emitFanoutEvent(jobId, job.context.clientId, 'approved', 'Job approved — ready for publishing');
  }
  // Trigger Inngest to publish
  // inngest.send({ name: 'fanout/job.approved', data: { jobId } })
}

export async function publishFanoutJob(jobId: string): Promise<void> {
  const job = await getFanoutJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  await updateFanoutJob(jobId, { status: 'publishing' });

  const results = await Promise.allSettled(
    job.posts.map(post => publishToAyrshare(post, job.context))
  );

  const allPublished = results.every(r => r.status === 'fulfilled');
  await updateFanoutJob(jobId, {
    status: allPublished ? 'published' : 'failed',
    publishedAt: allPublished ? new Date().toISOString() : undefined,
  });
  await emitFanoutEvent(
    jobId,
    job.context.clientId,
    allPublished ? 'published' : 'failed',
    allPublished ? `Published to ${job.platforms.join(', ')}` : 'Partial publish failure'
  );

  // Emit to Agency Engine activity feed
  if (allPublished) {
    try {
      await fetch(`${process.env.AGENCY_ENGINE_URL || ''}/api/platform/activity`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: job.context.clientId,
          source: 'content',
          type: 'content_published',
          message: `Published to ${job.platforms.join(', ')} — ${job.posts.length} posts live`,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Activity feed is optional
    }
  }
}

function deriveTopicFromJobType(job: FanoutJob): string {
  const topicsMap: Record<string, string> = {
    content_plan: `Latest in ${job.context.vertical} — what professionals need to know`,
    website_fix_followup: `How to improve your ${job.context.vertical} website's visibility`,
    compliance_education: `Compliance requirements for ${job.context.vertical} professionals in ${new Date().getFullYear()}`,
    local_service_pages: `${job.context.vertical} services in ${job.context.city || 'your area'} — what to look for`,
    audit_gap_fill: `Common website mistakes ${job.context.vertical} businesses make`,
    single_post: `${job.context.vertical} insight — ${new Date().toLocaleDateString()}`,
  };
  return topicsMap[job.type] || `${job.context.vertical} content`;
}

async function emitFanoutEvent(
  jobId: string,
  clientId: string,
  type: FanoutEvent['eventType'],
  message: string
) {
  await saveFanoutEvents([{
    id: crypto.randomUUID(),
    jobId,
    clientId,
    eventType: type,
    message,
    createdAt: new Date().toISOString(),
  }]);
}

// Re-export for convenience
export { recommendFanoutStrategy } from './strategy';
