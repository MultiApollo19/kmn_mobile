import { Pool, type QueryResultRow } from 'pg';

const getConnectionString = () => {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_HEALTH_CONNECTION_STRING ||
    ''
  ).trim();
};

let pool: Pool | null = null;
let lastPgCheckLogAt = 0;
const PG_CHECK_LOG_THROTTLE_MS = 60 * 1000;

type PgConnectionSummary = {
  host: string | null;
  port: number | null;
  database: string | null;
  user: string | null;
};

const getConnectionSummary = (): PgConnectionSummary => {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return {
      host: null,
      port: null,
      database: null,
      user: null,
    };
  }

  try {
    const parsed = new URL(connectionString);
    return {
      host: parsed.hostname || null,
      port: parsed.port ? Number(parsed.port) : 5432,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : null,
      user: parsed.username ? decodeURIComponent(parsed.username) : null,
    };
  } catch {
    return {
      host: null,
      port: null,
      database: null,
      user: null,
    };
  }
};

const getPool = () => {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Brak konfiguracji PostgreSQL (POSTGRES_URL / POSTGRES_CONNECTION_STRING / DATABASE_URL)');
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

  pool.on('error', (err) => {
    console.error('Pool error:', err);
  });

  return pool;
};

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  const client = await getPool().connect();
  try {
    return await client.query<T>(text, values);
  } catch (error) {
    console.error('PG Query Error:', { text, values, error });
    throw error;
  } finally {
    client.release();
  }
}

export async function logPostgresConnectionCheck(
  context: string,
  options: { force?: boolean } = {}
) {
  const now = Date.now();
  if (!options.force && now - lastPgCheckLogAt < PG_CHECK_LOG_THROTTLE_MS) {
    return;
  }
  lastPgCheckLogAt = now;

  const summary = getConnectionSummary();

  try {
    await pgQuery('SELECT 1 AS ok');
    console.info('[PG_CHECK] Connection OK', {
      context,
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; errno?: string | number };
    console.error('[PG_CHECK] Connection FAILED', {
      context,
      ...summary,
      message: err?.message ?? 'Nieznany błąd',
      code: err?.code ?? null,
      errno: err?.errno ?? null,
      timestamp: new Date().toISOString(),
    });
  }
}
