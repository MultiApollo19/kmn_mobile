import { NextResponse } from 'next/server';
import { logPostgresConnectionCheck, pgQuery } from '@/src/lib/postgres';

export const runtime = 'nodejs';

type VerifyPinBody = {
  pinHash: string;
};

type EmployeeRow = {
  id: string | number;
  name: string;
  role: 'user' | 'admin' | 'department_admin';
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

    await logPostgresConnectionCheck('auth.verify-pin.preflight');

    const result = await pgQuery<EmployeeRow>(
      `SELECT id, name, role, department_name
       FROM public.verify_employee_pin($1)
       LIMIT 1`,
      [pinHash]
    );

    const employee = result.rows[0];
    if (employee) {
      return NextResponse.json({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        department_name: employee.department_name || '',
      });
    }

    const legacyResult = await pgQuery<EmployeeRow>(
      `SELECT e.id, e.name, e.role, d.name AS department_name
       FROM public.employees e
       LEFT JOIN public.departments d ON d.id = e.department_id
       WHERE e.password ~* '^[a-f0-9]{64}$'
         AND lower(e.password) = lower($1)
       LIMIT 1`,
      [pinHash]
    );

    const legacyEmployee = legacyResult.rows[0];
    if (legacyEmployee) {
      console.warn('Verify PIN legacy hash match', {
        employeeId: legacyEmployee.id,
        role: legacyEmployee.role,
      });

      return NextResponse.json({
        id: legacyEmployee.id,
        name: legacyEmployee.name,
        role: legacyEmployee.role,
        department_name: legacyEmployee.department_name || '',
      });
    }

    return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 401 });
  } catch (error: unknown) {
    await logPostgresConnectionCheck('auth.verify-pin.catch', { force: true });
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
