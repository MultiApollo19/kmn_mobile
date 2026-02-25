import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

export const runtime = 'nodejs';

type MigrationLog = {
  step: string;
  status: 'info' | 'success' | 'error';
  message: string;
  timestamp: string;
};

const MIGRATION_FILES = [
  '00_schema.sql',
  '01_seed.sql',
  '02_functions.sql',
  '03_policies.sql',
  '04_triggers.sql',
  '05_event_logs.sql',
] as const;

const nowIso = () => new Date().toISOString();

const pushLog = (
  logs: MigrationLog[],
  status: MigrationLog['status'],
  step: string,
  message: string
) => {
  logs.push({
    step,
    status,
    message,
    timestamp: nowIso(),
  });
};

const getConnectionString = (request: Request) => {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get('connection_string')?.trim();

  if (fromQuery) {
    return fromQuery;
  }

  return process.env.POSTGRES_HEALTH_CONNECTION_STRING?.trim() || '';
};

export async function POST(request: Request) {
  const logs: MigrationLog[] = [];
  const startedAt = Date.now();

  try {
    const connectionString = getConnectionString(request);

    if (!connectionString) {
      pushLog(
        logs,
        'error',
        'validation',
        'Brak connection_string. Użyj: POST /api/db/migrate-pg?connection_string=postgres://user:pass@host:5432/db'
      );

      return NextResponse.json(
        {
          ok: false,
          logs,
        },
        { status: 400 }
      );
    }

    pushLog(logs, 'info', 'connect', 'Łączenie z bazą PostgreSQL...');

    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 8000,
    });

    await client.connect();
    pushLog(logs, 'success', 'connect', 'Połączono z bazą PostgreSQL.');

    try {
      for (const fileName of MIGRATION_FILES) {
        const step = `migration:${fileName}`;
        const filePath = path.join(process.cwd(), 'migrations_pg', fileName);

        pushLog(logs, 'info', step, `Wczytywanie pliku ${fileName}...`);
        const sql = await readFile(filePath, 'utf8');

        pushLog(logs, 'info', step, `Wykonywanie ${fileName}...`);
        await client.query(sql);

        pushLog(logs, 'success', step, `Zakończono ${fileName}.`);
      }
    } finally {
      await client.end().catch(() => undefined);
      pushLog(logs, 'info', 'disconnect', 'Połączenie z bazą zamknięte.');
    }

    const durationMs = Date.now() - startedAt;
    pushLog(logs, 'success', 'done', `Migracja zakończona pomyślnie w ${durationMs} ms.`);

    return NextResponse.json({
      ok: true,
      duration_ms: durationMs,
      executed_files: MIGRATION_FILES,
      logs,
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startedAt;
    const err = error as { message?: string };

    pushLog(logs, 'error', 'failed', err.message ?? 'Nieznany błąd podczas migracji.');

    return NextResponse.json(
      {
        ok: false,
        duration_ms: durationMs,
        logs,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hasConnectionString = Boolean(searchParams.get('connection_string'));

  return NextResponse.json({
    ok: true,
    message: 'Użyj metody POST, aby wykonać migracje PostgreSQL.',
    requires_connection_string: true,
    connection_string_present: hasConnectionString,
    files: MIGRATION_FILES,
    example: '/api/db/migrate-pg?connection_string=postgres://user:pass@host:5432/db',
  });
}
