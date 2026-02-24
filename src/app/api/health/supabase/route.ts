import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';

export const runtime = 'nodejs';

type DnsCheckResult = {
  ok: boolean;
  status: 'DNS ok' | 'DNS fail';
  hostname: string | null;
  address: string | null;
  family: number | null;
  error: string | null;
  code: string | null;
};

const checkDns = async (url: string): Promise<DnsCheckResult> => {
  try {
    const hostname = new URL(url).hostname;
    const result = await lookup(hostname);
    return {
      ok: true,
      status: 'DNS ok',
      hostname,
      address: result.address,
      family: result.family,
      error: null,
      code: null,
    };
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: string;
      hostname?: string;
      input?: string;
    };
    return {
      ok: false,
      status: 'DNS fail',
      hostname: err.hostname ?? err.input ?? null,
      address: null,
      family: null,
      error: err.message ?? 'DNS lookup failed',
      code: err.code ?? null,
    };
  }
};

export async function GET() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const envSource = 'NEXT_PUBLIC_SUPABASE_URL';

  const url = envUrl;
  const key = envKey;

  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL' },
      { status: 500 }
    );
  }

  const dns = await checkDns(url);

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });

    const info = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      supabaseUrl: url,
      envSource,
      dns
    };

    return NextResponse.json(info, { status: res.ok ? 200 : 502 });
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: string;
      cause?: { message?: string; code?: string; errno?: number; syscall?: string; hostname?: string };
    };
    return NextResponse.json(
      {
        ok: false,
        supabaseUrl: url,
        envSource,
        dns,
        error: err?.message || 'Fetch failed',
        code: err?.code ?? null,
        cause: err?.cause
          ? {
              message: err.cause.message ?? null,
              code: err.cause.code ?? null,
              errno: err.cause.errno ?? null,
              syscall: err.cause.syscall ?? null,
              hostname: err.cause.hostname ?? null
            }
          : null
      },
      { status: 502 }
    );
  }
}
