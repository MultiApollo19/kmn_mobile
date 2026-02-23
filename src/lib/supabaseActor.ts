import { createClient } from '@supabase/supabase-js';
import type { UserType } from '@/src/context/AuthContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const toHeaderSafeValue = (value: string) => encodeURIComponent(value);

export function buildActorHeaders(user?: UserType | null): Record<string, string> {
  const headers: Record<string, string> = {};

  if (user?.id !== undefined && user?.id !== null) {
    headers['x-employee-id'] = String(user.id);
  }
  if (user?.name) {
    headers['x-employee-name'] = toHeaderSafeValue(user.name);
  }
  if (user?.department) {
    headers['x-employee-department-name'] = toHeaderSafeValue(user.department);
  }

  return headers;
}

export function createActorClient(user?: UserType | null) {
  const headers = buildActorHeaders(user);

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers
    }
  });
}
