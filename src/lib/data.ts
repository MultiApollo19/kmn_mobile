import { unstable_cache } from 'next/cache';

// Cache configuration
export const REVALIDATE_LONG = false; // Cache indefinitely until revalidated by tag
export const REVALIDATE_SHORT = false; // Cache indefinitely until revalidated by tag

export const getVisitPurposes = unstable_cache(
  async () => {
    try {
      const response = await fetch(
        new URL('/api/db/query', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'settings.data', params: {} }),
          next: { tags: ['purposes'] },
        }
      );
      if (!response.ok) return [];
      const payload = await response.json() as { purposes: Array<{ id: number; name: string }> };
      return (payload.purposes || []).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  },
  ['visit_purposes'],
  { revalidate: REVALIDATE_LONG, tags: ['purposes'] }
);

export const getBadges = unstable_cache(
  async () => {
    try {
      const response = await fetch(
        new URL('/api/db/query', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'settings.data', params: {} }),
          next: { tags: ['badges'] },
        }
      );
      if (!response.ok) return [];
      const payload = await response.json() as { badges: Array<{ id: number; badge_number: string }> };
      return payload.badges || [];
    } catch {
      return [];
    }
  },
  ['badges'],
  { revalidate: REVALIDATE_LONG, tags: ['badges'] }
);

export const getGlobalActiveVisits = unstable_cache(
  async () => {
    try {
      const response = await fetch(
        new URL('/api/db/query', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'kiosk.bootstrap', params: {} }),
          next: { tags: ['visits'] },
        }
      );
      if (!response.ok) return [];
      const payload = await response.json() as { activeBadgeNumbers: string[] };
      return payload.activeBadgeNumbers || [];
    } catch {
      return [];
    }
  },
  ['global_active_visits'],
  { revalidate: REVALIDATE_SHORT, tags: ['visits'] }
);

export const getAdminDashboardData = unstable_cache(
  async () => {
    try {
      const response = await fetch(
        new URL('/api/db/query', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'dashboard.summary', params: {} }),
          next: { tags: ['dashboard'] },
        }
      );
      if (!response.ok) {
        return { visits: [], stats: { active: 0, todayVisits: 0, todayAvgTime: '-', totalAvgTime: '-' } };
      }
      const payload = await response.json() as {
        visits: Array<{
          id: number;
          entry_time: string;
          exit_time: string | null;
          visitor_name: string;
          notes: string | null;
          employees?: { name: string; departments?: { name: string } | null } | null;
          visit_purposes?: { name: string } | null;
          badges?: { badge_number: string } | null;
        }>;
        stats: {
          active: number;
          todayVisits: number;
          todayAvgTime: string;
          totalAvgTime: string;
        };
      };
      return payload || { visits: [], stats: { active: 0, todayVisits: 0, todayAvgTime: '-', totalAvgTime: '-' } };
    } catch {
      return { visits: [], stats: { active: 0, todayVisits: 0, todayAvgTime: '-', totalAvgTime: '-' } };
    }
  },
  ['admin_dashboard'],
  { revalidate: REVALIDATE_SHORT, tags: ['dashboard'] }
);
