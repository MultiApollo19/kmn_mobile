import type { UserType } from '@/src/context/AuthContext';

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
