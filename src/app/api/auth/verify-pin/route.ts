import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { logPostgresConnectionCheck, pgQuery } from '@/src/lib/postgres';

export const runtime = 'nodejs';

type VerifyPinBody = {
  pinHash: string;
  pin?: string;
};

type EmployeeRow = {
  id: string | number;
  name: string;
  role: 'user' | 'admin' | 'department_admin';
  department_name: string | null;
};

type EmployeeBcryptRow = EmployeeRow & {
  password: string | null;
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
    const { pinHash, pin } = await request.json() as VerifyPinBody;

    if (!pinHash || !/^[a-f0-9]{64}$/i.test(pinHash)) {
      return NextResponse.json({ error: 'Nieprawidłowy PIN' }, { status: 400 });
    }

    const normalizedPin = typeof pin === 'string' ? pin.trim() : '';
    const hasRawPin = /^\d{4}$/.test(normalizedPin);

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

    if (hasRawPin) {
      const legacyBcryptResult = await pgQuery<EmployeeRow>(
        `SELECT e.id, e.name, e.role, d.name AS department_name
         FROM public.employees e
         LEFT JOIN public.departments d ON d.id = e.department_id
         WHERE e.password IS NOT NULL
           AND e.password ~ '^\\$2[abyx]\\$'
           AND crypt($1, e.password) = e.password
         LIMIT 1`,
        [normalizedPin]
      );

      const legacyBcryptEmployee = legacyBcryptResult.rows[0];
      if (legacyBcryptEmployee) {
        console.warn('Verify PIN legacy raw bcrypt match', {
          employeeId: legacyBcryptEmployee.id,
          role: legacyBcryptEmployee.role,
        });

        try {
          await pgQuery(
            `UPDATE public.employees
             SET "password" = crypt($1, gen_salt('bf', 6))
             WHERE id = $2`,
            [pinHash, legacyBcryptEmployee.id]
          );
        } catch (migrationError) {
          console.warn('Verify PIN legacy migration failed', {
            employeeId: legacyBcryptEmployee.id,
            migrationError,
          });
        }

        return NextResponse.json({
          id: legacyBcryptEmployee.id,
          name: legacyBcryptEmployee.name,
          role: legacyBcryptEmployee.role,
          department_name: legacyBcryptEmployee.department_name || '',
        });
      }
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

    const unsupportedBcryptResult = await pgQuery<EmployeeBcryptRow>(
      `SELECT e.id, e.name, e.role, d.name AS department_name, e.password
       FROM public.employees e
       LEFT JOIN public.departments d ON d.id = e.department_id
       WHERE e.password ~ '^\\$2[bByY]\\$'`,
      []
    );

    for (const employeeRow of unsupportedBcryptResult.rows) {
      if (!employeeRow.password) continue;

      const compareValues = [pinHash, ...(hasRawPin ? [normalizedPin] : [])];
      for (const candidate of compareValues) {
        let isMatch = false;
        try {
          isMatch = bcrypt.compareSync(candidate, employeeRow.password);
        } catch {
          isMatch = false;
        }

        if (!isMatch) continue;

        console.warn('Verify PIN bcryptjs fallback match', {
          employeeId: employeeRow.id,
          role: employeeRow.role,
          candidateType: candidate === pinHash ? 'pin_hash' : 'raw_pin',
        });

        try {
          await pgQuery(
            `UPDATE public.employees
             SET "password" = crypt($1, gen_salt('bf', 6))
             WHERE id = $2`,
            [pinHash, employeeRow.id]
          );
        } catch (migrationError) {
          console.warn('Verify PIN bcryptjs fallback migration failed', {
            employeeId: employeeRow.id,
            migrationError,
          });
        }

        return NextResponse.json({
          id: employeeRow.id,
          name: employeeRow.name,
          role: employeeRow.role,
          department_name: employeeRow.department_name || '',
        });
      }
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
