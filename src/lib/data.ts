import { unstable_cache } from 'next/cache';
import { supabase } from './supabase';

// Cache configuration
export const REVALIDATE_LONG = 3600; // 1 hour
export const REVALIDATE_SHORT = 30;  // 30 seconds

export const getVisitPurposes = unstable_cache(
  async () => {
    const { data } = await supabase
      .from('visit_purposes')
      .select('*')
      .order('name', { ascending: true });
    return data || [];
  },
  ['visit_purposes'],
  { revalidate: REVALIDATE_LONG, tags: ['purposes'] }
);

export const getBadges = unstable_cache(
  async () => {
    const { data } = await supabase
      .from('badges')
      .select('*')
      .eq('is_active', true);
    return data || [];
  },
  ['badges'],
  { revalidate: REVALIDATE_LONG, tags: ['badges'] }
);

export const getGlobalActiveVisits = unstable_cache(
  async () => {
    const { data } = await supabase
      .from('visits')
      .select('badge:badges(badge_number)')
      .is('exit_time', null);
      
    if (!data) return [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((v: any) => v.badge?.badge_number).filter(Boolean) as string[];
  },
  ['global_active_visits'],
  { revalidate: REVALIDATE_SHORT, tags: ['visits'] }
);

export const getAdminDashboardData = unstable_cache(
  async () => {
    // 1. Fetch Active Visits (Detailed)
    const activeQuery = supabase
      .from('visits')
      .select(`
        id,
        entry_time,
        visitor_name,
        notes,
        employees (
          name,
          departments (
            name
          )
        ),
        visit_purposes (
          name
        ),
        badges (
          badge_number
        )
      `)
      .is('exit_time', null)
      .order('entry_time', { ascending: false });

    // 2. Fetch Stats
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const todayStatsQuery = supabase
      .from('visits')
      .select('entry_time, exit_time')
      .gte('entry_time', startOfDay);

    const totalStatsQuery = supabase
      .from('visits')
      .select('entry_time, exit_time')
      .not('exit_time', 'is', null);

    const [activeRes, todayStatsRes, totalStatsRes] = await Promise.all([
      activeQuery, 
      todayStatsQuery, 
      totalStatsQuery
    ]);

    // Calculate Stats
    const calculateAvg = (data: any[]) => {
      const completed = data.filter(v => v.exit_time);
      if (completed.length === 0) return '-';

      const totalDurationMs = completed.reduce((acc, v) => {
        const start = new Date(v.entry_time).getTime();
        const end = new Date(v.exit_time!).getTime();
        return acc + (end - start);
      }, 0);
      
      const avgMs = totalDurationMs / completed.length;
      const avgMinutes = Math.round(avgMs / 1000 / 60);

      if (avgMinutes < 60) {
        return `${avgMinutes} min`;
      }
      const h = Math.floor(avgMinutes / 60);
      const m = avgMinutes % 60;
      return `${h}h ${m}m`;
    };

    return {
      visits: activeRes.data || [],
      stats: {
        active: activeRes.data?.length || 0,
        todayVisits: todayStatsRes.data?.length || 0,
        todayAvgTime: calculateAvg(todayStatsRes.data || []),
        totalAvgTime: calculateAvg(totalStatsRes.data || [])
      }
    };
  },
  ['admin_dashboard_data'],
  { revalidate: 30, tags: ['dashboard'] }
);
