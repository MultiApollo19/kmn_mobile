import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DiagnosticBody = {
  pin?: string;
  pinHash?: string;
};

const toSha256Hex = (value: string) => {
  return createHash('sha256').update(value.trim()).digest('hex');
};

const getBearerToken = (request: Request) => {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const getDiagnosticToken = () => {
  return (
    process.env.ADMIN_DIAGNOSTIC_TOKEN?.trim() ||
    process.env.REVALIDATION_TOKEN?.trim() ||
    ''
  );
};

const toPinHash = (body: DiagnosticBody) => {
  if (typeof body.pinHash === 'string' && /^[a-f0-9]{64}$/i.test(body.pinHash)) {
    return body.pinHash;
  }

  if (typeof body.pin === 'string' && body.pin.trim()) {
    return toSha256Hex(body.pin);
  }

  return '';
};

const parseResponseBody = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  try {
    const expectedToken = getDiagnosticToken();
    if (!expectedToken) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Brak konfiguracji tokena diagnostycznego (ADMIN_DIAGNOSTIC_TOKEN lub REVALIDATION_TOKEN).',
        },
        { status: 503 }
      );
    }

    const providedToken = getBearerToken(request);
    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as DiagnosticBody;
    const pinHash = toPinHash(body);

    if (!pinHash) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Podaj pinHash (SHA-256 hex) albo pin.',
        },
        { status: 400 }
      );
    }

    const verifyUrl = new URL('/api/auth/verify-pin', request.url);
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinHash }),
      cache: 'no-store',
    });

    const verifyBody = await parseResponseBody(verifyRes);
    const classification = verifyRes.ok
      ? 'success'
      : verifyRes.status === 401
        ? 'invalid_pin'
        : verifyRes.status >= 500
          ? 'server_error'
          : 'other_error';

    return NextResponse.json(
      {
        ok: verifyRes.ok,
        classification,
        verify_pin_status: verifyRes.status,
        verify_pin_response: verifyBody,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      {
        ok: false,
        classification: 'server_error',
        verify_pin_status: 500,
        verify_pin_response: { error: err?.message || 'Unexpected error in diagnostic endpoint' },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: 'Użyj POST z Authorization: Bearer <token> i body { pin } albo { pinHash }.',
    },
    { status: 200 }
  );
}
