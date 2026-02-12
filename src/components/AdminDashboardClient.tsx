'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Loader2, Clock, FileText, X, User, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/src/lib/utils';
import Image from 'next/image';

export type Visit = {
  id: number;
  entry_time: string;
  exit_time: string | null;
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
  const [loading, setLoading] = useState(initialData.visits.length === 0);
  const showSkeleton = loading && visits.length === 0;
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [visitSignature, setVisitSignature] = useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(false);

  // Refresh function (still needed for manual refresh)
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Active Visits (Detailed)
      const activeQuery = supabase
        .from('visits')
        .select(`
          id,
          entry_time,
          exit_time,
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
        .from('visit_history')
        .select('visit_id, entry_time, exit_time')
        .gte('entry_time', startOfDay);

      const totalStatsQuery = supabase
        .from('visit_history')
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
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!selectedVisit) {
      setVisitSignature(null);
      return;
    }

    const fetchSignature = async () => {
      setLoadingSignature(true);
      try {
        const { data, error } = await supabase
          .from('visits')
          .select('signature')
          .eq('id', selectedVisit.id)
          .single();

        if (error) throw error;
        setVisitSignature(data.signature ?? null);
      } catch (err) {
        console.error('Error fetching signature:', err);
        setVisitSignature(null);
      } finally {
        setLoadingSignature(false);
      }
    };

    fetchSignature();
  }, [selectedVisit]);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      {showSkeleton ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="mt-4 h-8 w-20 bg-muted rounded" />
              <div className="mt-3 h-3 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Obecnie w firmie" value={stats.active.toString()} change="" neutral />
          <StatCard title="Dzisiejsze wizyty" value={stats.todayVisits.toString()} change="" neutral />
          <StatCard title="Średni czas wizyty (dziś)" value={stats.todayAvgTime} change="" neutral />
          <StatCard title="Średni czas wizyty (ogółem)" value={stats.totalAvgTime} change="" neutral />
        </div>
      )}

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

        {showSkeleton ? (
          <div className="p-6 animate-pulse">
            <div className="space-y-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-muted/60 rounded" />
              ))}
            </div>
          </div>
        ) : loading ? (
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
                  <th className="px-4 py-4 min-w-35">Czas wejścia</th>
                  <th className="px-4 py-4 min-w-50">Interesant</th>
                  <th className="px-4 py-4 min-w-50">Osoba przyjmująca</th>
                  <th className="px-4 py-4 min-w-37.5">Cel wizyty</th>
                  <th className="px-4 py-4 min-w-30">Identyfikator</th>
                  <th className="px-4 py-4">Uwagi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visits.map((visit) => (
                  <tr
                    key={visit.id}
                    onClick={() => setSelectedVisit(visit)}
                    className="hover:bg-muted/10 transition-colors group cursor-pointer"
                  >
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
                        <span className="font-mono text-foreground tracking-wide text-xs whitespace-nowrap">
                          {visit.badges?.badge_number}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground group-hover:text-foreground transition-colors" title={visit.notes}>
                      {visit.notes ? (
                        <div className="flex items-start gap-2">
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

      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Szczegóły wizyty</h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisit(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                <div className="p-6 space-y-6 bg-slate-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Interesant</h3>
                  </div>

                  <div>
                    <div className="text-xs text-slate-400 mb-1">Imię i nazwisko</div>
                    <div className="text-xl font-bold text-slate-900 leading-tight">{selectedVisit.visitor_name}</div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-slate-400 mb-1">Cel wizyty</div>
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100">
                        {selectedVisit.visit_purposes?.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Identyfikator</div>
                      <div className="text-lg font-mono font-bold text-slate-700 bg-white border border-slate-200 px-3 py-0.5 rounded shadow-sm">
                        {selectedVisit.badges?.badge_number}
                      </div>
                    </div>
                  </div>

                  {selectedVisit.notes ? (
                    <div className="pt-2">
                      <div className="text-xs text-slate-400 mb-1">Uwagi / Firma</div>
                      <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-lg text-sm text-amber-900 italic">
                        &quot;{selectedVisit.notes}&quot;
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="p-6 space-y-6 bg-white">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Czas i status</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Wejście</div>
                      <div className="text-2xl font-bold text-slate-900">{format(new Date(selectedVisit.entry_time), 'HH:mm')}</div>
                      <div className="text-xs text-slate-500">{format(new Date(selectedVisit.entry_time), 'dd.MM.yyyy')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Wyjście</div>
                      {selectedVisit.exit_time ? (
                        <>
                          <div className="text-2xl font-bold text-slate-900">{format(new Date(selectedVisit.exit_time), 'HH:mm')}</div>
                          <div className="text-xs text-slate-500">{format(new Date(selectedVisit.exit_time), 'dd.MM.yyyy')}</div>
                        </>
                      ) : (
                        <span className="text-lg text-emerald-600 font-medium italic">W trakcie</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-400 mb-1">Całkowity czas</div>
                    <div className="text-lg font-medium text-slate-700">
                      {selectedVisit.exit_time
                        ? `${Math.floor((new Date(selectedVisit.exit_time).getTime() - new Date(selectedVisit.entry_time).getTime()) / 60000)} min`
                        : '-'}
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 bg-slate-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Pracownik</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                      <div className="mt-1 p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                        <User className="w-3 h-3" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Wpuszczajacy</div>
                        <div className="font-semibold text-slate-900 text-sm">{selectedVisit.employees?.name}</div>
                        <div className="text-xs text-slate-500">{selectedVisit.employees?.departments?.name}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/50">
                    <div className="text-xs text-slate-400 mb-2">Podpis pracownika</div>
                    <div className="h-24 w-full bg-white rounded border border-slate-200 flex items-center justify-center relative overflow-hidden">
                      {loadingSignature ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                      ) : visitSignature ? (
                        <Image src={visitSignature} alt="Podpis" fill className="object-contain p-2" />
                      ) : (
                        <span className="text-xs text-slate-300 italic">Brak</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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