import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL' },
      { status: 500 }
    );
  }

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
      supabaseUrl: url
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
