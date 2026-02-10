'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Loader2, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  CalendarRange
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import DateRangePicker from '@/src/components/DateRangePicker';

type VisitSummary = {
  id: number;
  entry_time: string;
  exit_time: string | null;
  visitor_name: string;
  notes: string | null;
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

export default function SystemExitsPage() {
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showDateModal, setShowDateModal] = useState(false);
  
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
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
        .eq('is_system_exit', true);

      const now = new Date();
      
      if (dateRange === 'today') {
        const start = startOfDay(now).toISOString();
        query = query.or(`entry_time.gte.${start},exit_time.gte.${start}`);
      } else if (dateRange === 'yesterday') {
        const yesterday = subDays(now, 1);
        const start = startOfDay(yesterday).toISOString();
        const end = endOfDay(yesterday).toISOString();
        query = query.or(`and(entry_time.gte.${start},entry_time.lte.${end}),and(exit_time.gte.${start},exit_time.lte.${end})`);
      } else if (dateRange === 'week') {
        const start = subDays(now, 7).toISOString();
        query = query.or(`entry_time.gte.${start},exit_time.gte.${start}`);
      } else if (dateRange === 'custom' && customStart && customEnd) {
        const s = new Date(customStart);
        const e = new Date(customEnd);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
           const start = startOfDay(s).toISOString();
           const end = endOfDay(e).toISOString();
           query = query.or(`and(entry_time.gte.${start},entry_time.lte.${end}),and(exit_time.gte.${start},exit_time.lte.${end})`);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const sortedData = (data as unknown as VisitSummary[]).sort((a, b) => {
        return new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime();
      });

      setVisits(sortedData);
    } catch (error) {
      console.error('Error fetching system exits:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredVisits = visits.filter(visit => {
    const searchLower = searchTerm.toLowerCase();
    return (
      visit.visitor_name.toLowerCase().includes(searchLower) ||
      visit.employees?.name.toLowerCase().includes(searchLower) ||
      visit.notes?.toLowerCase().includes(searchLower) ||
      visit.badges?.badge_number.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredVisits.length / pageSize);
  const paginatedVisits = filteredVisits.slice((page - 1) * pageSize, page * pageSize);

  const summaryByEmployee = filteredVisits.reduce<Record<string, number>>((acc, visit) => {
    const name = visit.employees?.name?.trim() || 'Nieznany';
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  const summaryEntries = Object.entries(summaryByEmployee)
    .sort((a, b) => b[1] - a[1]);

  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    if (!filteredVisits.length) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      
      try {
        const fonts = [
          { url: '/fonts/Roboto-Regular.ttf', style: 'normal' },
          { url: '/fonts/Roboto-Bold.ttf', style: 'bold' }
        ];

        for (const font of fonts) {
          const res = await fetch(font.url);
          if (res.ok) {
            const fontBuffer = await res.arrayBuffer();
            const fontBytes = new Uint8Array(fontBuffer);
            let binary = '';
            for (let i = 0; i < fontBytes.length; i++) {
              binary += String.fromCharCode(fontBytes[i]);
            }
            const base64Font = btoa(binary);
            const fileName = font.url.split('/').pop()!;
            doc.addFileToVFS(fileName, base64Font);
            doc.addFont(fileName, 'Roboto', font.style);
          }
        }
        doc.setFont('Roboto'); 
      } catch (err) {
        console.error('Failed to load font:', err);
      }
      
      doc.setFontSize(16);
      doc.text('Raport Automatycznych Wyjść (Przekroczenia)', 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Wygenerowano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 22);

      const tableData = filteredVisits.map((v, index) => [
        index + 1,
        format(new Date(v.entry_time), 'yyyy-MM-dd HH:mm'),
        v.exit_time ? format(new Date(v.exit_time), 'yyyy-MM-dd HH:mm') : 'N/A',
        v.visitor_name,
        v.employees?.name || 'Nieznany',
        v.employees?.departments?.name || '',
        v.visit_purposes?.name || '',
        v.notes || ''
      ]);

      autoTable(doc, {
        theme: 'grid',
        head: [['Lp.', 'Wejście', 'Wyjście (System)', 'Interesant', 'Pracownik (Wpuszczający)', 'Dział', 'Cel', 'Uwagi']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8, cellPadding: 2, font: 'Roboto', valign: 'middle', overflow: 'linebreak', lineWidth: 0.1 },
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', lineWidth: 0.1 },
      });

      const summaryRows = summaryEntries.map(([name, count]) => [name, String(count)]);
      if (summaryRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 25;
        autoTable(doc, {
          theme: 'grid',
          head: [['Podsumowanie niezakończonych wizyt', 'Liczba']],
          body: summaryRows,
          startY: nextY,
          styles: { fontSize: 8, cellPadding: 2, font: 'Roboto', valign: 'middle', lineWidth: 0.1 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
          columnStyles: { 1: { halign: 'right' } }
        });
      }

      doc.save(`raport_system_exits_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Wystąpił błąd podczas generowania PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      setDateRange('custom');
      setShowDateModal(false);
    }
  };

  const handleRangeChange = (next: { start: Date | null; end: Date | null }) => {
    setCustomStart(next.start ? format(next.start, 'yyyy-MM-dd') : '');
    setCustomEnd(next.end ? format(next.end, 'yyyy-MM-dd') : '');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Szukaj (nazwisko, pracownik)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-input">
            <button onClick={() => setDateRange('today')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'today' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Dziś</button>
            <button onClick={() => setDateRange('yesterday')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'yesterday' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Wczoraj</button>
            <button onClick={() => setDateRange('week')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'week' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>7 dni</button>
            <button onClick={() => setShowDateModal(true)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${dateRange === 'custom' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><CalendarRange className="w-3 h-3" /> Zakres</button>
          </div>
          <div className="h-8 w-px bg-border mx-1"></div>
          <button onClick={exportToPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Eksportuj
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden min-h-125 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 opacity-20" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Brak wpisów</h3>
              <p className="text-sm max-w-xs text-center mt-2">W wybranym okresie nie odnotowano automatycznych wyjść.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-red-50 text-red-900 font-semibold border-b border-red-100">
                    <tr>
                      <th className="px-6 py-4">Data Wizyty</th>
                      <th className="px-6 py-4">Pracownik (Odpowiedzialny)</th>
                      <th className="px-6 py-4">Interesant</th>
                      <th className="px-6 py-4">Cel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedVisits.map((visit) => (
                      <tr key={visit.id} className="hover:bg-muted/10 transition-colors cursor-default">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{format(new Date(visit.entry_time), 'yyyy-MM-dd')}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(visit.entry_time), 'HH:mm')} - {visit.exit_time ? format(new Date(visit.exit_time), 'HH:mm') : '?'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-red-700">{visit.employees?.name}</span>
                            <span className="text-xs text-muted-foreground">{visit.employees?.departments?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col">
                              <span className="font-medium text-foreground">{visit.visitor_name}</span>
                              <span className="text-xs text-slate-500 font-mono">{visit.badges?.badge_number}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600">{visit.visit_purposes?.name}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
                   <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border rounded disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                   <span className="text-xs">Strona {page} z {totalPages}</span>
                   <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border rounded disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && filteredVisits.length > 0 && (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/10">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Podsumowanie niezakończonych wizyt
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Zestawienie liczby wizyt zakończonych przez system w wybranym zakresie.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="px-6 py-3">Pracownik</th>
                    <th className="px-6 py-3 text-right">Liczba wizyt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summaryEntries.map(([name, count]) => (
                    <tr key={name} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-3 font-medium text-foreground">{name}</td>
                      <td className="px-6 py-3 text-right font-semibold text-red-700">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
            <h3 className="font-semibold mb-4">Wybierz zakres</h3>
            <form onSubmit={handleCustomRangeSubmit} className="space-y-4">
              <DateRangePicker
                value={{
                  start: customStart ? new Date(customStart) : null,
                  end: customEnd ? new Date(customEnd) : null
                }}
                onChange={handleRangeChange}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowDateModal(false)} className="px-4 py-2 border rounded">Anuluj</button>
                <button type="submit" disabled={!customStart || !customEnd} className="px-4 py-2 bg-primary text-white rounded disabled:opacity-60">Zastosuj</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
