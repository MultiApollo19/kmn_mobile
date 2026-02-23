import { createClient } from '@supabase/supabase-js';
import { compare } from 'bcryptjs';
import { NextResponse, NextRequest } from 'next/server';
import { decryptPayload } from '@/src/lib/simpleDecryption';

export const runtime = 'nodejs';

type VerifyPinBody = {
  pin: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  role: 'user' | 'admin' | 'department_admin';
  password: string | null;
  departments: { name: string } | { name: string }[] | null;
};

const normalizeDepartment = (value: EmployeeRow['departments']) => {
  if (!value) return '';
  if (Array.isArray(value)) return value[0]?.name || '';
  return value.name || '';
};

export async function POST(request: NextRequest) {
  try {
    const { pin } = await decryptPayload<VerifyPinBody>(request);

    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Brak konfiguracji Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('employees')
      .select('id, name, role, password, departments(name)');

    if (error) {
      throw error;
    }

    const employees = (data || []) as EmployeeRow[];
    for (const employee of employees) {
      const hash = employee.password;
      if (!hash) continue;

      const isValid = await compare(pin, hash);
      if (!isValid) continue;

      return NextResponse.json({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        department_name: normalizeDepartment(employee.departments),
      });
    }

    return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 401 });
  } catch (error: unknown) {
    console.error('Verify PIN API Error:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      { error: err?.message || 'Wystąpił błąd serwera' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Use encrypted POST payload' },
    { status: 405 }
  );
}
