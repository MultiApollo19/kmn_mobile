import { NextResponse } from 'next/server';
import { pgQuery } from '@/src/lib/postgres';

export const runtime = 'nodejs';

type QueryBody = {
  query:
    | 'kiosk.bootstrap'
    | 'kiosk.activeVisits'
    | 'dashboard.summary'
    | 'visit.signature'
    | 'employees.list'
    | 'departments.list'
    | 'departments.employees'
    | 'settings.data'
    | 'reports.history'
    | 'reports.systemExits'
    | 'eventLogs.alertCount'
    | 'eventLogs.latest'
    | 'eventLogs.list'
    | 'admin.search';
  params?: Record<string, unknown>;
};

const toIsoStartEnd = (
  dateRange: string,
  customStart?: string,
  customEnd?: string
) => {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (dateRange === 'today') {
    const start = startOfDay(now);
    return { start: start.toISOString(), end: null as string | null };
  }
  if (dateRange === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { start: startOfDay(d).toISOString(), end: endOfDay(d).toISOString() };
  }
  if (dateRange === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { start: d.toISOString(), end: null as string | null };
  }
  if (dateRange === 'custom' && customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      return { start: startOfDay(s).toISOString(), end: endOfDay(e).toISOString() };
    }
  }

  const start = startOfDay(now);
  return { start: start.toISOString(), end: null as string | null };
};

const avgDurationLabel = (rows: Array<{ entry_time: string; exit_time: string | null }>) => {
  const completed = rows.filter((row) => row.exit_time);
  if (completed.length === 0) return '-';

  const totalMs = completed.reduce((acc, row) => {
    const start = new Date(row.entry_time).getTime();
    const end = new Date(row.exit_time as string).getTime();
    return acc + (end - start);
  }, 0);

  const avgMinutes = Math.round(totalMs / completed.length / 1000 / 60);
  if (avgMinutes < 60) return `${avgMinutes} min`;
  const h = Math.floor(avgMinutes / 60);
  const m = avgMinutes % 60;
  return `${h}h ${m}m`;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QueryBody;
    const { query } = body;
    const params = body.params || {};

    if (query === 'kiosk.bootstrap') {
      const [purposesRes, badgesRes, usedRes] = await Promise.all([
        pgQuery<{ id: number; name: string }>('SELECT id, name FROM public.visit_purposes ORDER BY name ASC'),
        pgQuery<{ id: number; badge_number: string; is_active: boolean }>(
          'SELECT id, badge_number, is_active FROM public.badges WHERE is_active = true ORDER BY badge_number ASC'
        ),
        pgQuery<{ badge_number: string }>(
          `SELECT b.badge_number
           FROM public.visits v
           JOIN public.badges b ON b.id = v.badge_id
           WHERE v.exit_time IS NULL`
        ),
      ]);

      return NextResponse.json({
        purposes: purposesRes.rows,
        badges: badgesRes.rows,
        usedBadgeNumbers: usedRes.rows.map((row) => row.badge_number).filter(Boolean),
      });
    }

    if (query === 'kiosk.activeVisits') {
      const departmentName = typeof params.departmentName === 'string' ? params.departmentName : null;

      const res = await pgQuery<{
        id: number;
        entry_time: string;
        visitor_name: string;
        notes: string;
        badge_number: string;
        purpose_name: string;
        employee_name: string;
        department_name: string | null;
      }>(
        `SELECT
           v.id,
           v.entry_time,
           v.visitor_name,
           COALESCE(v.notes, '') AS notes,
           b.badge_number,
           vp.name AS purpose_name,
           e.name AS employee_name,
           d.name AS department_name
         FROM public.visits v
         JOIN public.badges b ON b.id = v.badge_id
         JOIN public.visit_purposes vp ON vp.id = v.purpose_id
         JOIN public.employees e ON e.id = v.employee_id
         LEFT JOIN public.departments d ON d.id = e.department_id
         WHERE v.exit_time IS NULL
           AND ($1::text IS NULL OR d.name = $1)
         ORDER BY v.entry_time DESC`,
        [departmentName]
      );

      const data = res.rows.map((row) => ({
        id: row.id,
        entry_time: row.entry_time,
        visitor_name: row.visitor_name,
        notes: row.notes,
        badge: { badge_number: row.badge_number },
        purpose: { name: row.purpose_name },
        employee: {
          name: row.employee_name,
          departments: { name: row.department_name || '' },
        },
      }));

      return NextResponse.json({ data });
    }

    if (query === 'dashboard.summary') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const [activeRes, todayRes, totalRes] = await Promise.all([
        pgQuery<{
          id: number;
          entry_time: string;
          exit_time: string | null;
          visitor_name: string;
          notes: string;
          employee_name: string;
          department_name: string | null;
          purpose_name: string;
          badge_number: string;
        }>(
          `SELECT
             v.id,
             v.entry_time,
             v.exit_time,
             v.visitor_name,
             COALESCE(v.notes, '') AS notes,
             e.name AS employee_name,
             d.name AS department_name,
             vp.name AS purpose_name,
             b.badge_number
           FROM public.visits v
           JOIN public.employees e ON e.id = v.employee_id
           LEFT JOIN public.departments d ON d.id = e.department_id
           JOIN public.visit_purposes vp ON vp.id = v.purpose_id
           JOIN public.badges b ON b.id = v.badge_id
           WHERE v.exit_time IS NULL
           ORDER BY v.entry_time DESC`
        ),
        pgQuery<{ entry_time: string; exit_time: string | null }>(
          'SELECT entry_time, exit_time FROM public.visit_history WHERE entry_time >= $1',
          [startOfDay]
        ),
        pgQuery<{ entry_time: string; exit_time: string | null }>(
          'SELECT entry_time, exit_time FROM public.visit_history WHERE exit_time IS NOT NULL'
        ),
      ]);

      return NextResponse.json({
        visits: activeRes.rows.map((row) => ({
          id: row.id,
          entry_time: row.entry_time,
          exit_time: row.exit_time,
          visitor_name: row.visitor_name,
          notes: row.notes,
          employees: {
            name: row.employee_name,
            departments: row.department_name ? { name: row.department_name } : null,
          },
          visit_purposes: { name: row.purpose_name },
          badges: { badge_number: row.badge_number },
        })),
        stats: {
          active: activeRes.rows.length,
          todayVisits: todayRes.rows.length,
          todayAvgTime: avgDurationLabel(todayRes.rows),
          totalAvgTime: avgDurationLabel(totalRes.rows),
        },
      });
    }

    if (query === 'visit.signature') {
      const visitId = Number(params.visitId);
      if (!Number.isFinite(visitId)) {
        return NextResponse.json({ error: 'Nieprawidłowe visitId' }, { status: 400 });
      }
      const res = await pgQuery<{ signature: string | null }>(
        'SELECT signature FROM public.visits WHERE id = $1 LIMIT 1',
        [visitId]
      );
      return NextResponse.json({ signature: res.rows[0]?.signature ?? null });
    }

    if (query === 'employees.list') {
      const [employeesRes, departmentsRes] = await Promise.all([
        pgQuery<{
          id: number;
          name: string;
          has_pin: boolean;
          department_id: number | null;
          role: 'user' | 'admin' | 'department_admin';
          department_name: string | null;
        }>(
          `SELECT e.id, e.name, (e.password IS NOT NULL) AS has_pin, e.department_id, e.role, d.name AS department_name
           FROM public.employees e
           LEFT JOIN public.departments d ON d.id = e.department_id
           ORDER BY e.name ASC`
        ),
        pgQuery<{ id: number; name: string }>('SELECT id, name FROM public.departments ORDER BY name ASC'),
      ]);

      return NextResponse.json({
        employees: employeesRes.rows.map((row) => ({
          id: row.id,
          name: row.name,
          has_pin: row.has_pin,
          department_id: row.department_id,
          role: row.role,
          departments: row.department_id && row.department_name
            ? { id: row.department_id, name: row.department_name }
            : null,
        })),
        departments: departmentsRes.rows,
      });
    }

    if (query === 'departments.list') {
      const res = await pgQuery<{ id: number; name: string }>(
        'SELECT id, name FROM public.departments ORDER BY id ASC'
      );
      return NextResponse.json({ departments: res.rows });
    }

    if (query === 'departments.employees') {
      const departmentId = Number(params.departmentId);
      if (!Number.isFinite(departmentId)) {
        return NextResponse.json({ error: 'Nieprawidłowe departmentId' }, { status: 400 });
      }
      const res = await pgQuery<{ name: string }>(
        'SELECT name FROM public.employees WHERE department_id = $1 ORDER BY name ASC',
        [departmentId]
      );
      return NextResponse.json({ employees: res.rows });
    }

    if (query === 'settings.data') {
      const [purposesRes, badgesRes] = await Promise.all([
        pgQuery<{ id: number; name: string }>('SELECT id, name FROM public.visit_purposes ORDER BY name ASC'),
        pgQuery<{ id: number; badge_number: string; is_active: boolean; created_at: string }>(
          'SELECT id, badge_number, is_active, created_at FROM public.badges ORDER BY badge_number ASC'
        ),
      ]);

      return NextResponse.json({ purposes: purposesRes.rows, badges: badgesRes.rows });
    }

    if (query === 'reports.history' || query === 'reports.systemExits') {
      const dateRange = typeof params.dateRange === 'string' ? params.dateRange : 'today';
      const customStart = typeof params.customStart === 'string' ? params.customStart : undefined;
      const customEnd = typeof params.customEnd === 'string' ? params.customEnd : undefined;
      const { start, end } = toIsoStartEnd(dateRange, customStart, customEnd);
      const onlySystem = query === 'reports.systemExits';

      const values: unknown[] = [start, end, onlySystem];
      const rows = await pgQuery<{
        id: number;
        purpose_id: number | null;
        badge_id: number | null;
        entry_time: string;
        exit_time: string | null;
        visitor_name: string;
        notes: string | null;
        signature: string | null;
        is_system_exit: boolean;
        employee_name: string | null;
        department_name: string | null;
        exit_employee_name: string | null;
        purpose_name: string | null;
        badge_number: string | null;
      }>(
        `SELECT
           vh.visit_id AS id,
           vh.purpose_id,
           vh.badge_id,
           vh.entry_time,
           vh.exit_time,
           vh.visitor_name,
           vh.notes,
           vh.signature,
           COALESCE(vh.is_system_exit, false) AS is_system_exit,
           e.name AS employee_name,
           d.name AS department_name,
           ee.name AS exit_employee_name,
           vp.name AS purpose_name,
           b.badge_number
         FROM public.visit_history vh
         LEFT JOIN public.employees e ON e.id = vh.employee_id
         LEFT JOIN public.departments d ON d.id = e.department_id
         LEFT JOIN public.employees ee ON ee.id = vh.exit_employee_id
         LEFT JOIN public.visit_purposes vp ON vp.id = vh.purpose_id
         LEFT JOIN public.badges b ON b.id = vh.badge_id
         WHERE
           ($3::boolean = false OR COALESCE(vh.is_system_exit, false) = true)
           AND (
             ($2::timestamptz IS NULL AND (vh.entry_time >= $1::timestamptz OR vh.exit_time >= $1::timestamptz OR vh.exit_time IS NULL))
             OR
             ($2::timestamptz IS NOT NULL AND ((vh.entry_time BETWEEN $1::timestamptz AND $2::timestamptz) OR (vh.exit_time BETWEEN $1::timestamptz AND $2::timestamptz)))
           )
         ORDER BY vh.entry_time DESC`,
        values
      );

      return NextResponse.json({
        visits: rows.rows.map((row) => ({
          id: row.id,
          purpose_id: row.purpose_id,
          badge_id: row.badge_id,
          entry_time: row.entry_time,
          exit_time: row.exit_time,
          visitor_name: row.visitor_name,
          notes: row.notes,
          signature: row.signature,
          is_system_exit: row.is_system_exit,
          employees: row.employee_name
            ? {
                name: row.employee_name,
                departments: row.department_name ? { name: row.department_name } : null,
              }
            : null,
          exit_employees: row.exit_employee_name ? { name: row.exit_employee_name } : null,
          visit_purposes: row.purpose_name ? { name: row.purpose_name } : null,
          badges: row.badge_number ? { badge_number: row.badge_number } : null,
        })),
      });
    }

    if (query === 'eventLogs.alertCount') {
      const sinceIso = typeof params.sinceIso === 'string' ? params.sinceIso : new Date(Date.now() - 86400000).toISOString();
      const res = await pgQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM public.event_logs
         WHERE created_at >= $1::timestamptz
           AND level IN ('warn', 'error')`,
        [sinceIso]
      );
      return NextResponse.json({ count: Number(res.rows[0]?.count || 0) });
    }

    if (query === 'eventLogs.latest') {
      const limit = Math.min(50, Math.max(1, Number(params.limit) || 8));
      const res = await pgQuery(
        `SELECT *
         FROM public.event_logs
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return NextResponse.json({ items: res.rows });
    }

    if (query === 'eventLogs.list') {
      const searchTerm = typeof params.searchTerm === 'string' ? params.searchTerm.trim() : '';
      const eventType = typeof params.eventType === 'string' ? params.eventType.trim() : '';
      const actorName = typeof params.actorName === 'string' ? params.actorName.trim() : '';
      const resourceType = typeof params.resourceType === 'string' ? params.resourceType.trim() : '';
      const level = typeof params.level === 'string' ? params.level.trim() : '';
      const category = typeof params.category === 'string' ? params.category.trim() : '';
      const limit = Math.min(500, Math.max(10, Number(params.limit) || 100));
      const dateRange = typeof params.dateRange === 'string' ? params.dateRange : 'today';
      const customStart = typeof params.customStart === 'string' ? params.customStart : undefined;
      const customEnd = typeof params.customEnd === 'string' ? params.customEnd : undefined;
      const { start, end } = toIsoStartEnd(dateRange, customStart, customEnd);

      const where: string[] = [];
      const values: unknown[] = [];

      if (searchTerm) {
        values.push(`%${searchTerm}%`);
        where.push(`(event_type ILIKE $${values.length} OR actor_name ILIKE $${values.length})`);
      }
      if (eventType) {
        values.push(`%${eventType}%`);
        where.push(`event_type ILIKE $${values.length}`);
      }
      if (actorName) {
        values.push(`%${actorName}%`);
        where.push(`actor_name ILIKE $${values.length}`);
      }
      if (resourceType) {
        values.push(resourceType);
        where.push(`resource_type = $${values.length}`);
      }
      if (level) {
        values.push(level);
        where.push(`level = $${values.length}`);
      }
      if (category) {
        if (category === 'other') {
          where.push(`event_type NOT ILIKE 'auth.%' AND event_type NOT ILIKE 'visit.%' AND event_type NOT ILIKE 'admin.%' AND event_type NOT ILIKE 'system.%'`);
        } else {
          values.push(`${category}.%`);
          where.push(`event_type ILIKE $${values.length}`);
        }
      }

      values.push(start);
      if (end) {
        values.push(end);
        where.push(`created_at BETWEEN $${values.length - 1}::timestamptz AND $${values.length}::timestamptz`);
      } else {
        where.push(`created_at >= $${values.length}::timestamptz`);
      }

      values.push(limit);

      const sql = `
        SELECT *
        FROM public.event_logs
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${values.length}
      `;

      const res = await pgQuery(sql, values);
      return NextResponse.json({ logs: res.rows });
    }

    if (query === 'admin.search') {
      const searchTerm = typeof params.searchTerm === 'string' ? params.searchTerm.trim() : '';
      const limit = 5;

      if (!searchTerm) {
        return NextResponse.json({ employees: [], departments: [], purposes: [], badges: [] });
      }

      const likePattern = `%${searchTerm}%`;

      const [employeesRes, departmentsRes, purposesRes, badgesRes] = await Promise.all([
        pgQuery(
          'SELECT id, name FROM public.employees WHERE name ILIKE $1 LIMIT $2',
          [likePattern, limit]
        ),
        pgQuery(
          'SELECT id, name FROM public.departments WHERE name ILIKE $1 LIMIT $2',
          [likePattern, limit]
        ),
        pgQuery(
          'SELECT id, name FROM public.visit_purposes WHERE name ILIKE $1 LIMIT $2',
          [likePattern, limit]
        ),
        pgQuery(
          'SELECT id, badge_number FROM public.badges WHERE badge_number ILIKE $1 LIMIT $2',
          [likePattern, limit]
        ),
      ]);

      return NextResponse.json({
        employees: employeesRes.rows,
        departments: departmentsRes.rows,
        purposes: purposesRes.rows,
        badges: badgesRes.rows,
      });
    }

    return NextResponse.json({ error: 'Nieznane zapytanie' }, { status: 400 });
  } catch (error: unknown) {
    console.error('DB query API Error:', error);
    const err = error as { message?: string };
    return NextResponse.json({ error: err?.message || 'Wystąpił błąd serwera' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}
