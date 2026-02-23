import { createClient } from '@supabase/supabase-js';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const decodeActorHeader = (value: string | null) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type ManageEmployeeBody = {
  id: number | null;
  name: string;
  department_id: number | null;
  role: 'user' | 'admin' | 'department_admin';
  pinHash: string | null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as ManageEmployeeBody;
    const { id, name, department_id, role, pinHash } = body;

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Brak konfiguracji Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)');
    }

    // Use the caller's authorization (Admin) to perform operations
    const authHeader = request.headers.get('Authorization');
    const actorHeaders: Record<string, string> = {};
    const actorId = request.headers.get('x-employee-id');
    const actorName = decodeActorHeader(request.headers.get('x-employee-name'));
    const actorDeptName = decodeActorHeader(request.headers.get('x-employee-department-name'));
    if (actorId) actorHeaders['x-employee-id'] = actorId;
    if (actorName) actorHeaders['x-employee-name'] = actorName;
    if (actorDeptName) actorHeaders['x-employee-department-name'] = actorDeptName;

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader || '',
            ...actorHeaders
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

    // 2. Handle PIN without sending plaintext to Supabase RPC
    if (pinHash) {
      if (!/^[a-f0-9]{64}$/i.test(pinHash)) {
        return NextResponse.json({ error: 'Nieprawidłowy format PIN hash' }, { status: 400 });
      }

      const hashedPin = await hash(pinHash, 12);
      const { error: pinError } = await supabase
        .from('employees')
        .update({
          password: hashedPin,
        })
        .eq('id', targetId);

      if (pinError) throw pinError;
    }

    return NextResponse.json({ success: true, id: targetId });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const err = error as { message?: string; code?: string; details?: string | null; hint?: string | null };
    const message = err?.message || 'Wystąpił błąd serwera';
    return NextResponse.json(
      {
        error: message,
        code: err?.code ?? null,
        details: err?.details ?? null,
        hint: err?.hint ?? null
      },
      { status: 500 }
    );
  }
}
