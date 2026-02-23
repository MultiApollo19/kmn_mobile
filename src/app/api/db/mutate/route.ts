import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { decryptRequestPayload } from '@/src/lib/requestEncryption.server';

export const runtime = 'nodejs';

type FilterOp = 'eq' | 'is' | 'gte' | 'lt';

type MutationFilter = {
  column: string;
  op: FilterOp;
  value: unknown;
};

type MutationAction = 'insert' | 'update' | 'delete';

type MutationBody = {
  table: string;
  action: MutationAction;
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  filters?: MutationFilter[];
};

const ALLOWED_TABLES = new Set([
  'visits',
  'user_logs',
  'visit_purposes',
  'badges',
  'departments',
  'employees',
]);

function applyFilters<
  T extends {
    eq: (column: string, value: unknown) => T;
    is: (column: string, value: unknown) => T;
    gte: (column: string, value: unknown) => T;
    lt: (column: string, value: unknown) => T;
  },
>(
  query: T,
  filters: MutationFilter[] = []
) {
  let current = query;

  for (const filter of filters) {
    if (filter.op === 'eq') current = current.eq(filter.column, filter.value);
    if (filter.op === 'is') current = current.is(filter.column, filter.value);
    if (filter.op === 'gte') current = current.gte(filter.column, filter.value);
    if (filter.op === 'lt') current = current.lt(filter.column, filter.value);
  }

  return current;
}

export async function POST(request: Request) {
  try {
    const encryptedBody = await request.json();
    const body = decryptRequestPayload<MutationBody>(request, encryptedBody);
    const { table, action, values, filters } = body;

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'Tabela nie jest dozwolona' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Brak konfiguracji Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)');
    }

    const authHeader = request.headers.get('Authorization');
    const actorHeaders: Record<string, string> = {};
    const actorId = request.headers.get('x-employee-id');
    const actorName = request.headers.get('x-employee-name');
    const actorDeptName = request.headers.get('x-employee-department-name');
    if (actorId) actorHeaders['x-employee-id'] = actorId;
    if (actorName) actorHeaders['x-employee-name'] = actorName;
    if (actorDeptName) actorHeaders['x-employee-department-name'] = actorDeptName;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader || '',
          ...actorHeaders,
        },
      },
    });

    if (action === 'insert') {
      if (!values) return NextResponse.json({ error: 'Brak values dla insert' }, { status: 400 });
      const { error } = await supabase.from(table).insert(values);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      if (!values) return NextResponse.json({ error: 'Brak values dla update' }, { status: 400 });
      const query = supabase.from(table).update(values);
      const filtered = applyFilters(query, filters);
      const { error } = await filtered;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const query = supabase.from(table).delete();
    const filtered = applyFilters(query, filters);
    const { error } = await filtered;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('DB mutate API Error:', error);
    const err = error as { message?: string; code?: string; details?: string | null };
    return NextResponse.json(
      {
        error: err?.message || 'Wystąpił błąd serwera',
        code: err?.code ?? null,
        details: err?.details ?? null,
      },
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
