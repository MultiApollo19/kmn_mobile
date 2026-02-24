import { NextResponse } from 'next/server';
import * as dns from 'dns';
import { Client } from 'pg';

export const runtime = 'nodejs';

const dnsLookupPromise = (hostname: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
};

type PostgresHealthResult = {
  ok: boolean;
  status: 'DNS ok' | 'DNS fail' | 'Port reachable' | 'Port unreachable';
  host: string | null;
  port: number | null;
  database: string | null;
  user: string | null;
  error: string | null;
  duration_ms: number;
};

const normalizeConnectionString = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^postgres(ql)?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const decoded = decodeURIComponent(trimmed);
    if (/^postgres(ql)?:\/\//i.test(decoded)) {
      return decoded;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const checkPostgres = async (connectionString: string): Promise<PostgresHealthResult> => {
  const startTime = Date.now();

  try {
    const parsedUrl = new URL(connectionString);
    const protocol = parsedUrl.protocol.toLowerCase();
    if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
      const duration_ms = Date.now() - startTime;
      return {
        ok: false,
        status: 'DNS fail',
        host: null,
        port: null,
        database: null,
        user: null,
        error: 'Invalid connection string format',
        duration_ms,
      };
    }

    const user = parsedUrl.username ? decodeURIComponent(parsedUrl.username) : null;
    const host = parsedUrl.hostname || null;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 5432;
    const database = parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : null;

    if (!host) {
      const duration_ms = Date.now() - startTime;
      return {
        ok: false,
        status: 'DNS fail',
        host: null,
        port,
        database,
        user,
        error: 'Missing host in connection string',
        duration_ms,
      };
    }

    // Test DNS resolution
    try {
      await dnsLookupPromise(host);
    } catch (dnsError: unknown) {
      const err = dnsError as { message?: string };
      const duration_ms = Date.now() - startTime;
      return {
        ok: false,
        status: 'DNS fail',
        host,
        port,
        database,
        user,
        error: err.message ?? 'DNS lookup failed',
        duration_ms,
      };
    }

    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      const duration_ms = Date.now() - startTime;
      return {
        ok: true,
        status: 'Port reachable',
        host,
        port,
        database,
        user,
        error: null,
        duration_ms,
      };
    } catch (connectionError: unknown) {
      const err = connectionError as { message?: string };
      const duration_ms = Date.now() - startTime;
      return {
        ok: false,
        status: 'Port unreachable',
        host,
        port,
        database,
        user,
        error: err.message ?? 'Unable to connect to PostgreSQL',
        duration_ms,
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (error: unknown) {
    console.error('PostgreSQL check error:', error);
    const err = error as { message?: string };
    const duration_ms = Date.now() - startTime;
    return {
      ok: false,
      status: 'DNS fail',
      host: null,
      port: null,
      database: null,
      user: null,
      error: err.message ?? 'Unexpected error during parsing',
      duration_ms,
    };
  }
};

export async function GET(request: Request) {
  try {
    // Read connection string from query param or env
    const { searchParams } = new URL(request.url);
    const rawConnectionString = searchParams.get('connection_string') || '';
    const connectionString = normalizeConnectionString(rawConnectionString);

    console.log('Raw connectionString:', connectionString);

    if (!connectionString) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing connection_string query parameter. Use: /api/health/postgres?connection_string=postgres://user:pass@host:5432/db',
        },
        { status: 400 }
      );
    }

    const result = await checkPostgres(connectionString);

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error: unknown) {
    console.error('GET /api/health/postgres error:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      {
        ok: false,
        error: 'Unexpected error in GET',
        message: err.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { connection_string?: string };
    const { connection_string } = body;

    if (!connection_string) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing connection_string in request body',
        },
        { status: 400 }
      );
    }

    const decodedConnection = normalizeConnectionString(connection_string);

    const result = await checkPostgres(decodedConnection);

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error: unknown) {
    console.error('POST /api/health/postgres error:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to parse request',
        message: err.message,
      },
      { status: 400 }
    );
  }
}
