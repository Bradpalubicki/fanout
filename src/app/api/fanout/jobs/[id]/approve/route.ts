export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getFanoutJob } from '@/lib/fanout/storage';
import { approveFanoutJob } from '@/lib/fanout/pipeline';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    const job = await getFanoutJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'review_required') {
      return NextResponse.json(
        { error: `Job cannot be approved in status: ${job.status}` },
        { status: 400 }
      );
    }

    await approveFanoutJob(jobId);

    return NextResponse.json({
      ok: true,
      jobId,
      status: 'approved',
    });
  } catch (error) {
    console.error('Approve fanout job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve job' },
      { status: 500 }
    );
  }
}
