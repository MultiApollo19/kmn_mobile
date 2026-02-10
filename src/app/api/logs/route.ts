import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type LogEventBody = {
  event_type?: unknown;
  level?: unknown;
  action?: unknown;
  actor?: {
    type?: unknown;
    id?: unknown;
    name?: unknown;
    department_id?: unknown;
    department_name?: unknown;
  };
  resource?: {
    type?: unknown;
    id?: unknown;
  };
  source?: unknown;
  correlation_id?: unknown;
  context?: unknown;
};

const allowedLevels = new Set(['audit', 'info', 'warn', 'error', 'debug']);
const allowedSources = new Set(['client', 'server', 'trigger']);

function asString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function asOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function toIdString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  return null;
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }
  return request.headers.get('x-real-ip');
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  let body: LogEventBody | null = null;
  try {
    body = (await request.json()) as LogEventBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = asString(body.event_type);
  if (!eventType) {
    return NextResponse.json({ ok: false, error: 'Missing event_type' }, { status: 400 });
  }

  const levelRaw = asOptionalString(body.level) || 'info';
  const level = allowedLevels.has(levelRaw) ? levelRaw : 'info';
  const action = asOptionalString(body.action);

  const actor = body.actor || {};
  const resource = body.resource || {};

  const sourceRaw = asOptionalString(body.source) || 'client';
  const source = allowedSources.has(sourceRaw) ? sourceRaw : 'client';

  const correlationId = asOptionalString(body.correlation_id) || crypto.randomUUID();

  const ip = getRequestIp(request);
  const userAgent = request.headers.get('user-agent');

  const context = typeof body.context === 'object' && body.context !== null ? body.context : null;

  const payload = {
    event_type: eventType,
    level,
    action,
    actor_type: asOptionalString(actor.type),
    actor_id: toIdString(actor.id),
    actor_name: asOptionalString(actor.name),
    department_id: asOptionalNumber(actor.department_id),
    department_name: asOptionalString(actor.department_name),
    resource_type: asOptionalString(resource.type),
    resource_id: toIdString(resource.id),
    source,
    ip_address: ip,
    user_agent: userAgent,
    correlation_id: correlationId,
    context
  };

  const { error } = await supabaseAdmin.from('event_logs').insert(payload);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
