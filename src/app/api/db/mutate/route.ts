import { NextResponse } from 'next/server';
import { pgQuery } from '@/src/lib/postgres';

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

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const quoteIdent = (identifier: string) => {
  if (!IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`Nieprawidłowy identyfikator: ${identifier}`);
  }
  return `"${identifier}"`;
};

const buildWhereClause = (filters: MutationFilter[] = [], values: unknown[]) => {
  if (!filters.length) return '';

  const conditions = filters.map((filter) => {
    const col = quoteIdent(filter.column);
    if (filter.op === 'is') {
      return filter.value === null ? `${col} IS NULL` : `${col} IS NOT NULL`;
    }

    values.push(filter.value);
    const idx = values.length;
    if (filter.op === 'eq') return `${col} = $${idx}`;
    if (filter.op === 'gte') return `${col} >= $${idx}`;
    return `${col} < $${idx}`;
  });

  return ` WHERE ${conditions.join(' AND ')}`;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as MutationBody;
    const { table, action, values, filters } = body;

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'Tabela nie jest dozwolona' }, { status: 400 });
    }

    const tableName = quoteIdent(table);

    if (action === 'insert') {
      if (!values) return NextResponse.json({ error: 'Brak values dla insert' }, { status: 400 });

      const rows = Array.isArray(values) ? values : [values];
      if (!rows.length) return NextResponse.json({ error: 'Puste values dla insert' }, { status: 400 });

      if (table === 'employees') {
        const hasSensitiveColumns = rows.some((row) => {
          const payload = row as Record<string, unknown>;
          return Object.prototype.hasOwnProperty.call(payload, 'password') || Object.prototype.hasOwnProperty.call(payload, 'pin_hash');
        });

        if (hasSensitiveColumns) {
          return NextResponse.json(
            { error: 'Zmiana PIN przez db/mutate jest zablokowana. Użyj /api/employees/manage.' },
            { status: 400 }
          );
        }
      }

      const columns = Object.keys(rows[0]);
      if (!columns.length) return NextResponse.json({ error: 'Brak kolumn dla insert' }, { status: 400 });

      const sqlValues: unknown[] = [];
      const valueTuples = rows.map((row) => {
        const placeholders = columns.map((column) => {
          sqlValues.push((row as Record<string, unknown>)[column]);
          return `$${sqlValues.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });

      const columnSql = columns.map((column) => quoteIdent(column)).join(', ');
      await pgQuery(
        `INSERT INTO public.${tableName} (${columnSql}) VALUES ${valueTuples.join(', ')}`,
        sqlValues
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      if (!values) return NextResponse.json({ error: 'Brak values dla update' }, { status: 400 });

      if (table === 'employees') {
        const payload = values as Record<string, unknown>;
        const touchesSensitiveColumns =
          Object.prototype.hasOwnProperty.call(payload, 'password') ||
          Object.prototype.hasOwnProperty.call(payload, 'pin_hash');

        if (touchesSensitiveColumns) {
          return NextResponse.json(
            { error: 'Zmiana PIN przez db/mutate jest zablokowana. Użyj /api/employees/manage.' },
            { status: 400 }
          );
        }
      }

      const entries = Object.entries(values);
      if (!entries.length) return NextResponse.json({ error: 'Brak pól do update' }, { status: 400 });

      const sqlValues: unknown[] = [];
      const setSql = entries
        .map(([column, value]) => {
          sqlValues.push(value);
          return `${quoteIdent(column)} = $${sqlValues.length}`;
        })
        .join(', ');

      const whereSql = buildWhereClause(filters, sqlValues);
      await pgQuery(
        `UPDATE public.${tableName} SET ${setSql}${whereSql}`,
        sqlValues
      );

      return NextResponse.json({ success: true });
    }

    const sqlValues: unknown[] = [];
    const whereSql = buildWhereClause(filters, sqlValues);
    await pgQuery(`DELETE FROM public.${tableName}${whereSql}`, sqlValues);

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
    { message: 'Method not allowed' },
    { status: 405 }
  );
}
