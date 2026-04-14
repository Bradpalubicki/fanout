import { NextRequest, NextResponse } from 'next/server';
import { publishFanoutJob } from '@/lib/fanout/pipeline';
import { getFanoutJob } from '@/lib/fanout/storage';

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

    if (job.status !== 'approved') {
      return NextResponse.json(
        { error: `Job cannot be published in status: ${job.status}. Must be approved first.` },
        { status: 400 }
      );
    }

    await publishFanoutJob(jobId);

    const updatedJob = await getFanoutJob(jobId);

    return NextResponse.json({
      ok: true,
      jobId,
      status: updatedJob?.status || 'published',
      publishedAt: updatedJob?.publishedAt,
    });
  } catch (error) {
    console.error('Publish fanout job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish job' },
      { status: 500 }
    );
  }
}
