export type LogEventPayload = {
  event_type: string;
  level?: 'audit' | 'info' | 'warn' | 'error' | 'debug';
  action?: string;
  actor?: {
    type?: string;
    id?: string | number;
    name?: string;
    department_id?: number | null;
    department_name?: string | null;
  };
  resource?: {
    type?: string;
    id?: string | number;
  };
  source?: 'client' | 'server' | 'trigger';
  correlation_id?: string;
  context?: Record<string, unknown>;
};

export async function logEvent(payload: LogEventPayload) {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // Logging should never block the user flow.
  }
}
