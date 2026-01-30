import { NextResponse } from 'next/server';
import { supabase } from '@/src/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Check for optional authorization if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch all active visits (exit_time is null)
    const { data: activeVisits, error: fetchError } = await supabase
      .from('visits')
      .select('*')
      .is('exit_time', null);

    if (fetchError) {
      console.error('Error fetching active visits:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!activeVisits || activeVisits.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active visits to exit.',
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    const updates = activeVisits.map((visit) => {
      const entryDate = new Date(visit.entry_time);
      const exitDate = new Date(entryDate);
      
      // Set exit time to 15:00 local time approx (14:00 UTC) on the day of entry
      // This ensures "every visit ends on the day of commencement"
      exitDate.setUTCHours(14, 0, 0, 0); 

      // Handle edge case: If entry was after 15:00 (e.g. 16:00), 
      // closing at 15:00 would be invalid (negative duration).
      // In that case, close at end of day.
      if (exitDate < entryDate) {
        exitDate.setUTCHours(23, 59, 59, 0);
      }

      return {
        ...visit, // Spread all existing fields (employee_id, badge_id, etc.) to satisfy NOT NULL constraints during Upsert
        exit_time: exitDate.toISOString(),
        is_system_exit: true,
      };
    });

    // Perform bulk update
    const { error: updateError } = await supabase
      .from('visits')
      .upsert(updates);

    if (updateError) {
      console.error('Error auto-exiting visits:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Auto-exited ${updates.length} visits.`,
      count: updates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
