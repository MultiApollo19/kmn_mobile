import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { pgQuery } from '@/src/lib/postgres';

export const runtime = 'nodejs';

type VerifyPinBody = {
  pinHash: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  role: 'user' | 'admin' | 'department_admin';
  password: string | null;
  department_name: string | null;
};

type ErrorCauseDiagnostics = {
  code: string | null;
  errno: string | number | null;
  syscall: string | null;
  hostname: string | null;
};

const getErrorCauseDiagnostics = (error: unknown): ErrorCauseDiagnostics => {
  if (!error || typeof error !== 'object') {
    return { code: null, errno: null, syscall: null, hostname: null };
  }

  const errorWithCause = error as { cause?: unknown };
  const cause = errorWithCause.cause;
  if (!cause || typeof cause !== 'object') {
    return { code: null, errno: null, syscall: null, hostname: null };
  }

  const networkCause = cause as {
    code?: string;
    errno?: string | number;
    syscall?: string;
    hostname?: string;
  };

  return {
    code: networkCause.code ?? null,
    errno: networkCause.errno ?? null,
    syscall: networkCause.syscall ?? null,
    hostname: networkCause.hostname ?? null,
  };
};

export async function POST(request: Request) {
  try {
    const { pinHash } = await request.json() as VerifyPinBody;

    if (!pinHash || !/^[a-f0-9]{64}$/i.test(pinHash)) {
      return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 400 });
    }

    const result = await pgQuery<EmployeeRow>(
      `SELECT e.id, e.name, e.role, e.password, d.name AS department_name
       FROM public.employees e
       LEFT JOIN public.departments d ON d.id = e.department_id`
    );

    const employees = result.rows;
    for (const employee of employees) {
      const hash = employee.password;
      if (!hash) continue;

      const isValid = await compare(pinHash, hash);
      if (!isValid) continue;

      return NextResponse.json({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        department_name: employee.department_name || '',
      });
    }

    return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 401 });
  } catch (error: unknown) {
    console.error('Verify PIN API Error:', error);
    const err = error as { message?: string };
    const diagnostics = getErrorCauseDiagnostics(error);
    const detailedMessage = diagnostics.code
      ? `${err?.message || 'Wystąpił błąd serwera'} (${diagnostics.code})`
      : (err?.message || 'Wystąpił błąd serwera');

    return NextResponse.json(
      {
        error: detailedMessage,
        cause: diagnostics,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  );
}
