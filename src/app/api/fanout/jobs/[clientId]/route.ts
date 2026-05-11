export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getFanoutJobsByClient } from '@/lib/fanout/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    const jobs = await getFanoutJobsByClient(clientId);

    return NextResponse.json({
      ok: true,
      jobs,
    });
  } catch (error) {
    console.error('Get fanout jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get jobs' },
      { status: 500 }
    );
  }
}
