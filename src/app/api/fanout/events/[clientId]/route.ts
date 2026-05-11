export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getFanoutEventsByClient } from '@/lib/fanout/storage';
import { verifyInternalKey } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const authErr = verifyInternalKey(req.headers.get('authorization'));
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });

  try {
    const { clientId } = await params;

    const events = await getFanoutEventsByClient(clientId);

    return NextResponse.json({
      ok: true,
      events,
    });
  } catch (error) {
    console.error('Get fanout events error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get events' },
      { status: 500 }
    );
  }
}
