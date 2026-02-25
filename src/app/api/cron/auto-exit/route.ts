import { NextResponse } from 'next/server';
import { pgQuery } from '@/src/lib/postgres';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AutoExitBody = {
  secret: string;
};

export async function POST(request: Request) {
  try {
    const { secret } = await request.json() as AutoExitBody;

    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && secret !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    const activeRes = await pgQuery<{
      id: number;
      entry_time: string;
    }>(
      `SELECT id, entry_time
       FROM public.visits
       WHERE exit_time IS NULL`
    );

    const activeVisits = activeRes.rows;

    if (!activeVisits || activeVisits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active visits to exit.',
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    for (const visit of activeVisits) {
      const entryDate = new Date(visit.entry_time);
      const exitDate = new Date(entryDate);

      exitDate.setUTCHours(14, 0, 0, 0);

      if (exitDate < entryDate) {
        exitDate.setUTCHours(23, 59, 59, 0);
      }

      await pgQuery(
        `UPDATE public.visits
         SET exit_time = $1, is_system_exit = true
         WHERE id = $2`,
        [exitDate.toISOString(), visit.id]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Auto-exited ${activeVisits.length} visits.`,
      count: activeVisits.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  );
}