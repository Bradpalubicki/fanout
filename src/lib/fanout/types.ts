export type FanoutJobType =
  | 'content_plan'           // recurring content schedule per client
  | 'authority_cluster'      // 6-piece content cluster for weak authority areas
  | 'website_fix_followup'   // content supporting a service engine fix
  | 'compliance_education'   // content explaining compliance requirements
  | 'local_service_pages'    // supporting content for local SEO pages
  | 'audit_gap_fill'         // content filling gaps found by audit engine
  | 'single_post';           // one-off post generation + publish

export type FanoutJobStatus =
  | 'queued'
  | 'generating'
  | 'review_required'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'retrying';

export type FanoutPlatform =
  | 'linkedin'
  | 'twitter'
  | 'blog'
  | 'facebook'
  | 'instagram'
  | 'ghost'
  | 'medium'
  | 'threads';

export interface FanoutClientContext {
  agencyId: string;
  clientId: string;
  clientName: string;
  website: string;
  vertical: string;     // 'appraiser' | 'dental' | 'wellness' | etc.
  city?: string;
  auditScore?: number;
  complianceRisk?: 'low' | 'moderate' | 'high';
  topIssues?: string[];  // from latest audit — informs content strategy
}

export interface FanoutJob {
  id: string;
  type: FanoutJobType;
  status: FanoutJobStatus;
  context: FanoutClientContext;

  // What triggered this job
  sourceEngine: 'service_engine' | 'audit_engine' | 'reveal_app' | 'agency_engine' | 'manual';
  sourceId?: string;  // projectId, revealId, auditId — whichever triggered it

  platforms: FanoutPlatform[];
  posts: FanoutPost[];

  scheduledAt?: string;
  publishedAt?: string;
  failedAt?: string;
  retryCount: number;

  createdAt: string;
  updatedAt: string;
}

export interface FanoutPost {
  id: string;
  jobId: string;
  platform: FanoutPlatform;
  content: string;
  status: 'draft' | 'approved' | 'published' | 'failed';
  publishedAt?: string;
  platformPostId?: string;  // ID returned by Ayrshare after publish
  scheduledFor?: string;
}

export interface FanoutEvent {
  id: string;
  jobId: string;
  clientId: string;
  eventType: 'queued' | 'generated' | 'approved' | 'published' | 'failed' | 'retried' | 'completed';
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// Input contract — what other engines send to Fanout
export interface CreateFanoutJobInput {
  type: FanoutJobType;
  context: FanoutClientContext;
  sourceEngine: FanoutJob['sourceEngine'];
  sourceId?: string;
  platforms: FanoutPlatform[];
  instructions?: string;  // Optional: specific content direction from calling engine
  scheduleAt?: string;    // Optional: when to publish
  requiresApproval?: boolean;  // default: true
}
