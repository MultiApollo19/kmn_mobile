'use client';

import { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Loader2, Building2, Clock, FileText, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/src/lib/utils';

export type Visit = {
  id: number;
  entry_time: string;
  visitor_name: string;
  notes: string;
  employees: {
    name: string;
    departments: {
      name: string;
    } | null;
  } | null;
  visit_purposes: {
    name: string;
  } | null;
  badges: {
    badge_number: string;
  } | null;
};

interface DashboardStats {
  active: number;
  todayVisits: number;
  todayAvgTime: string;
  totalAvgTime: string;
}

interface AdminDashboardClientProps {
  initialData: {
    visits: Visit[];
    stats: DashboardStats;
  };
}

export default function AdminDashboardClient({ initialData }: AdminDashboardClientProps) {
  // Initialize with server data
  const [visits, setVisits] = useState<Visit[]>(initialData.visits);
  const [stats, setStats] = useState<DashboardStats>(initialData.stats);
  const [loading, setLoading] = useState(false); // Initially false because we have data

  // Refresh function (still needed for manual refresh)
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Active Visits (Detailed)
      const activeQuery = supabase
        .from('visits')
        .select(`
          id,
          entry_time,
          visitor_name,
          notes,
          employees:employees!visits_employee_id_fkey (
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
        .select('id, entry_time, exit_time')
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

      if (activeRes.error) {
        console.error('Active Query Error:', activeRes.error);
        throw activeRes.error;
      }
      if (todayStatsRes.error) {
        console.error('Today Stats Query Error:', todayStatsRes.error);
        throw todayStatsRes.error;
      }
      if (totalStatsRes.error) {
        console.error('Total Stats Query Error:', totalStatsRes.error);
        throw totalStatsRes.error;
      }

      const activeVisits = activeRes.data;
      
      // Deduplicate history for Today's Stats
      const todayVisits = todayStatsRes.data || [];
      
      const totalVisits = totalStatsRes.data;

      // Calculate Stats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      setVisits(activeVisits as unknown as Visit[]);
      setStats({
        active: activeVisits.length,
        todayVisits: todayVisits.length,
        todayAvgTime: calculateAvg(todayVisits),
        totalAvgTime: calculateAvg(totalVisits)
      });

    } catch (error) {
      console.error('Error fetching visits full details:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Obecnie w firmie" value={stats.active.toString()} change="Teraz" neutral />
        <StatCard title="Dzisiejsze wizyty" value={stats.todayVisits.toString()} change="Dzisiaj" neutral />
        <StatCard title="Średni czas wizyty (dziś)" value={stats.todayAvgTime} change="Średnia" neutral />
        <StatCard title="Średni czas wizyty (ogółem)" value={stats.totalAvgTime} change="Średnia" neutral />
      </div>

      {/* Active Visits Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-muted/10">
          <div>
            <h3 className="font-bold text-xl text-foreground">Aktywne wizyty</h3>
            <p className="text-sm text-muted-foreground mt-1">Osoby przebywające obecnie na terenie zakładu</p>
          </div>
          <button 
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded-full transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
            title="Odśwież"
          >
            <Clock className="w-4 h-4" />
            Odśwież
          </button>
        </div>

        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : visits.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            Brak aktywnych wizyt w tym momencie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-4 min-w-[140px]">Czas wejścia</th>
                  <th className="px-4 py-4 min-w-[200px]">Interesant</th>
                  <th className="px-4 py-4 min-w-[200px]">Osoba przyjmująca</th>
                  <th className="px-4 py-4 min-w-[150px]">Cel wizyty</th>
                  <th className="px-4 py-4 min-w-[120px]">Identyfikator</th>
                  <th className="px-4 py-4">Uwagi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-foreground">
                          {format(new Date(visit.entry_time), 'HH:mm', { locale: pl })}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          {format(new Date(visit.entry_time), 'dd MMM', { locale: pl })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">                      
                        <span className="font-semibold text-foreground text-base">{visit.visitor_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{visit.employees?.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Building2 className="w-3.5 h-3.5 opacity-70" />
                          {visit.employees?.departments?.name || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {visit.visit_purposes?.name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border w-fit shadow-sm">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-foreground tracking-wide text-xs whitespace-nowrap">
                          {visit.badges?.badge_number}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground group-hover:text-foreground transition-colors" title={visit.notes}>
                      {visit.notes ? (
                        <div className="flex items-start gap-2">
                           <FileText className="w-4 h-4 opacity-50 mt-0.5" />
                           <span className="whitespace-pre-wrap">{visit.notes}</span>
                        </div>
                      ) : (
                        <span className="opacity-30">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, change, positive, neutral }: { title: string, value: string, change: string, positive?: boolean, neutral?: boolean }) {
  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full",
          neutral ? "bg-muted text-muted-foreground" :
          positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        )}>
          {change}
        </span>
      </div>
    </div>
  );
}