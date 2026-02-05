import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, department_id, role, pin } = body;

    // Use the caller's authorization (Admin) to perform operations
    const authHeader = request.headers.get('Authorization');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader || '',
          },
        },
      }
    );

    // 1. Upsert Employee Data
    const employeeData: { name: string; department_id: number | null; role: string } = {
      name,
      department_id: department_id || null,
      role
    };
    
    let targetId = id;

    if (id) {
       const { error: updateError } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', id);
       if (updateError) throw updateError;
    } else {
       const { data: newEmp, error: insertError } = await supabase
        .from('employees')
        .insert(employeeData)
        .select('id')
        .single();
       if (insertError) throw insertError;
       targetId = newEmp.id;
    }

    // 2. Handle PIN (Update DB Hash only)
    if (pin) {
      const { error: pinError } = await supabase.rpc('update_employee_password', {
        p_employee_id: targetId,
        p_pin: pin
      });
      if (pinError) throw pinError;
    }

    return NextResponse.json({ success: true, id: targetId });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Wystąpił błąd serwera';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
