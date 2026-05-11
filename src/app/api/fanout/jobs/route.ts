export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createFanoutJob, runFanoutPipeline } from '@/lib/fanout';
import type { FanoutJobType, FanoutPlatform } from '@/lib/fanout';

const CreateJobSchema = z.object({
  type: z.enum([
    'content_plan',
    'authority_cluster',
    'website_fix_followup',
    'compliance_education',
    'local_service_pages',
    'audit_gap_fill',
    'single_post',
  ] as const),
  context: z.object({
    agencyId: z.string(),
    clientId: z.string(),
    clientName: z.string(),
    website: z.string(),
    vertical: z.string(),
    city: z.string().optional(),
    auditScore: z.number().optional(),
    complianceRisk: z.enum(['low', 'moderate', 'high']).optional(),
    topIssues: z.array(z.string()).optional(),
  }),
  sourceEngine: z.enum(['service_engine', 'audit_engine', 'reveal_app', 'agency_engine', 'manual']),
  sourceId: z.string().optional(),
  platforms: z.array(z.enum([
    'linkedin', 'twitter', 'blog', 'facebook', 'instagram', 'ghost', 'medium', 'threads',
  ] as const)),
  instructions: z.string().optional(),
  scheduleAt: z.string().optional(),
  requiresApproval: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    const input = parsed.data;

    // Create the job
    const job = await createFanoutJob({
      type: input.type as FanoutJobType,
      context: input.context,
      sourceEngine: input.sourceEngine,
      sourceId: input.sourceId,
      platforms: input.platforms as FanoutPlatform[],
      instructions: input.instructions,
      scheduleAt: input.scheduleAt,
      requiresApproval: input.requiresApproval ?? true,
    });

    // If approval not required, immediately run the pipeline
    if (input.requiresApproval === false) {
      await runFanoutPipeline(job.id);
    }

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    console.error('Create fanout job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    );
  }
}
