'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, CalendarRange, Search, SlidersHorizontal } from 'lucide-react';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { cn } from '@/src/lib/utils';
import { createActorClient } from '@/src/lib/supabaseActor';
import { useAuth } from '@/src/hooks/useAuth';

type EventLog = {
  id: number;
  created_at: string;
  event_type: string;
  level: string;
  action: string | null;
  actor_type: string | null;
  actor_id: string | null;
  actor_name: string | null;
  department_name: string | null;
  resource_type: string | null;
  resource_id: string | null;
  source: string | null;
  context: Record<string, unknown> | null;
};

const levelOptions = ['audit', 'info', 'warn', 'error', 'debug'];
const resourceOptions = ['visit', 'employee', 'department', 'purpose', 'badge'];
const categoryOptions = [
  { value: '', label: 'Wszystkie' },
  { value: 'auth', label: 'Autoryzacja' },
  { value: 'visit', label: 'Wizyty' },
  { value: 'admin', label: 'Panel admina' },
  { value: 'system', label: 'System' },
  { value: 'other', label: 'Inne' }
];

const friendlyEventNames: Record<string, string> = {
  'auth.pin.verify': 'Weryfikacja PIN',
  'auth.login': 'Logowanie',
  'auth.logout': 'Wylogowanie',
  'auth.failed': 'Nieudane logowanie',
  'auth.expired': 'Wygaśnięcie sesji',
  'visit.entry': 'Wejście wizyty',
  'visit.exit': 'Wyjście wizyty',
  'visit.auto_exit': 'Auto-wyjście (system)',
  'visit.update': 'Aktualizacja wizyty',
  'visit.delete': 'Usunięcie wizyty',
  'admin.employee.create': 'Dodanie pracownika',
  'admin.employee.update': 'Edycja pracownika',
  'admin.employee.delete': 'Usunięcie pracownika',
  'admin.employee.pin_update': 'Zmiana PIN pracownika',
  'admin.department.create': 'Dodanie działu',
  'admin.department.update': 'Edycja działu',
  'admin.department.delete': 'Usunięcie działu',
  'admin.purpose.create': 'Dodanie celu wizyty',
  'admin.purpose.update': 'Edycja celu wizyty',
  'admin.purpose.delete': 'Usunięcie celu wizyty',
  'admin.badge.create': 'Dodanie identyfikatora',
  'admin.badge.update': 'Edycja identyfikatora',
  'admin.badge.delete': 'Usunięcie identyfikatora',
  'admin.badge.toggle': 'Zmiana statusu identyfikatora'
};

function getEventCategory(eventType: string) {
  if (eventType.startsWith('auth.')) return 'auth';
  if (eventType.startsWith('visit.')) return 'visit';
  if (eventType.startsWith('admin.')) return 'admin';
  if (eventType.startsWith('system.')) return 'system';
  return 'other';
}

function getEventLabel(eventType: string) {
  return friendlyEventNames[eventType] || eventType;
}

function getCategoryBadge(category: string) {
  switch (category) {
    case 'auth':
      return 'bg-amber-100 text-amber-700';
    case 'visit':
      return 'bg-emerald-100 text-emerald-700';
    case 'admin':
      return 'bg-indigo-100 text-indigo-700';
    case 'system':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function AdminLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventType, setEventType] = useState('');
  const [actorName, setActorName] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(100);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const client = createActorClient(user);
    let query = client
      .from('event_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(`event_type.ilike.${term},actor_name.ilike.${term}`);
    }
    if (eventType.trim()) {
      query = query.ilike('event_type', `%${eventType.trim()}%`);
    }
    if (actorName.trim()) {
      query = query.ilike('actor_name', `%${actorName.trim()}%`);
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }
    if (level) {
      query = query.eq('level', level);
    }
    if (category) {
      if (category === 'other') {
        query = query.not('event_type', 'ilike', 'auth.%')
          .not('event_type', 'ilike', 'visit.%')
          .not('event_type', 'ilike', 'admin.%')
          .not('event_type', 'ilike', 'system.%');
      } else {
        query = query.ilike('event_type', `${category}.%`);
      }
    }
    const now = new Date();
    if (dateRange === 'today') {
      const start = startOfDay(now).toISOString();
      query = query.gte('created_at', start);
    } else if (dateRange === 'yesterday') {
      const yesterday = subDays(now, 1);
      const start = startOfDay(yesterday).toISOString();
      const end = endOfDay(yesterday).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (dateRange === 'week') {
      const start = subDays(now, 7).toISOString();
      query = query.gte('created_at', start);
    } else if (dateRange === 'custom' && customStart && customEnd) {
      const start = startOfDay(new Date(customStart)).toISOString();
      const end = endOfDay(new Date(customEnd)).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setLogs([]);
    } else {
      setLogs((data || []) as EventLog[]);
    }

    setLoading(false);
  }, [actorName, category, customEnd, customStart, dateRange, eventType, level, limit, resourceType, searchTerm, user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleReset = () => {
    setEventType('');
    setSearchTerm('');
    setActorName('');
    setResourceType('');
    setLevel('');
    setCategory('');
    setDateRange('today');
    setCustomStart('');
    setCustomEnd('');
    setLimit(100);
  };

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      setDateRange('custom');
      setShowDateModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Logi zdarzeń</h1>
        <p className="text-muted-foreground">Przegląd zmian i aktywności w systemie.</p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Szukaj po zdarzeniu lub aktorze..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-input">
              <button onClick={() => setDateRange('today')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'today' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Dziś</button>
              <button onClick={() => setDateRange('yesterday')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'yesterday' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Wczoraj</button>
              <button onClick={() => setDateRange('week')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'week' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>7 dni</button>
              <button onClick={() => setShowDateModal(true)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${dateRange === 'custom' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <CalendarRange className="w-3 h-3" /> Zakres
              </button>
            </div>
            <div className="h-8 w-px bg-border mx-1"></div>
            <button
              onClick={fetchLogs}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <RefreshCw className="h-4 w-4" />
              Odśwież
            </button>
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors',
                showFilters ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtry
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Typ zdarzenia</label>
            <input
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="np. admin.employee.update"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Aktor</label>
            <input
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Imie lub nazwisko"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Kategoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Zasob</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              {resourceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Poziom</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              {levelOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {[50, 100, 250, 500].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Brak logow dla wybranych filtrow.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Czas</th>
                  <th className="px-4 py-3">Zdarzenie</th>
                  <th className="px-4 py-3">Poziom</th>
                  <th className="px-4 py-3">Aktor</th>
                  <th className="px-4 py-3">Zasob</th>
                  <th className="px-4 py-3">Akcja</th>
                  <th className="px-4 py-3">Szczegoly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pl-PL')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{getEventLabel(log.event_type)}</span>
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            getCategoryBadge(getEventCategory(log.event_type))
                          )}>
                            {getEventCategory(log.event_type)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{log.event_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        log.level === 'error' ? 'bg-rose-100 text-rose-700' :
                        log.level === 'warn' ? 'bg-amber-100 text-amber-700' :
                        log.level === 'audit' ? 'bg-blue-100 text-blue-700' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">{log.actor_name || '-'}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.actor_type || '-'}{log.department_name ? ` • ${log.department_name}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-foreground">{log.resource_type || '-'}</span>
                        <span className="text-xs text-muted-foreground">{log.resource_id || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{log.action || '-'}</td>
                    <td className="px-4 py-3">
                      {log.context ? (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">Pokaz</summary>
                          <pre className="mt-2 whitespace-pre-wrap break-words">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h3 className="font-semibold mb-4">Wybierz zakres</h3>
            <form onSubmit={handleCustomRangeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data poczatkowa</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data koncowa</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowDateModal(false)} className="px-4 py-2 border rounded">Anuluj</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">Zastosuj</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
