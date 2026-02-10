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
  FileText,
  X,
  Clock,
  User,
  Building2,
  CalendarRange,
  LogOut
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import Image from 'next/image';
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
  exit_employees: {
    name: string;
  } | null;
  is_system_exit?: boolean;
  visit_purposes: {
    name: string;
  } | null;
  badges: {
    badge_number: string;
  } | null;
};

export default function HistoryReportPage() {
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filtering State
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showDateModal, setShowDateModal] = useState(false);
  
  // Details Modal
  const [selectedVisit, setSelectedVisit] = useState<VisitSummary | null>(null);
  const [visitSignature, setVisitSignature] = useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Querying the visits table
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
          is_system_exit,
          exit_employees:employees!visits_exit_employee_id_fkey (
            name
          ),
          visit_purposes (
            name
          ),
          badges (
            badge_number
          )
        `);

      // Date Filtering
      const now = new Date();
      
      if (dateRange === 'today') {
        const start = startOfDay(now).toISOString();
        query = query.or(`entry_time.gte.${start},exit_time.gte.${start},exit_time.is.null`);
      } else if (dateRange === 'yesterday') {
        const yesterday = subDays(now, 1);
        const start = startOfDay(yesterday).toISOString();
        const end = endOfDay(yesterday).toISOString();
        query = query.or(`and(entry_time.gte.${start},entry_time.lte.${end}),and(exit_time.gte.${start},exit_time.lte.${end})`);
      } else if (dateRange === 'week') {
        const start = subDays(now, 7).toISOString();
        query = query.or(`entry_time.gte.${start},exit_time.gte.${start},exit_time.is.null`);
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
      
      const uniqueVisits = data as unknown as VisitSummary[];

      const sortedData = uniqueVisits.sort((a, b) => {
        if (a.exit_time === null && b.exit_time !== null) return -1;
        if (a.exit_time !== null && b.exit_time === null) return 1;
        return new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime();
      });

      setVisits(sortedData);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Fetch signature from visits table
  useEffect(() => {
    if (selectedVisit) {
      const fetchSignature = async () => {
        setLoadingSignature(true);
        try {
          const { data, error } = await supabase
            .from('visits')
            .select('signature')
            .eq('id', selectedVisit.id) 
            .single();
            
          if (error) throw error;
          setVisitSignature(data.signature);
        } catch (err) {
          console.error("Error fetching signature", err);
          setVisitSignature(null);
        } finally {
          setLoadingSignature(false);
        }
      };
      fetchSignature();
    } else {
      setVisitSignature(null);
    }
  }, [selectedVisit]);

  const filteredVisits = visits.filter(visit => {
    const searchLower = searchTerm.toLowerCase();
    return (
      visit.visitor_name.toLowerCase().includes(searchLower) ||
      visit.employees?.name.toLowerCase().includes(searchLower) ||
      visit.notes?.toLowerCase().includes(searchLower) ||
      visit.badges?.badge_number.toLowerCase().includes(searchLower) ||
      (visit.is_system_exit && 'system'.includes(searchLower))
    );
  });

  const totalPages = Math.ceil(filteredVisits.length / pageSize);
  const paginatedVisits = filteredVisits.slice((page - 1) * pageSize, page * pageSize);

  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    if (!filteredVisits.length) return;
    setIsExporting(true);

    try {
      const ids = filteredVisits.map(v => v.id); // these are visit ids now
      
      const { data: signaturesData, error } = await supabase
        .from('visits')
        .select('id, signature')
        .in('id', ids);

      if (error) throw error;

      const visitsWithSignatures = filteredVisits.map(v => ({
        ...v,
        signature: signaturesData?.find(s => s.id === v.id)?.signature || null
      }));

      const doc = new jsPDF({ orientation: 'landscape' });
      
      // Load fonts (assumes public folder access)
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
      doc.text('Raport Historii Wizyt', 14, 15);
      
      doc.setFontSize(10);
      const genDate = `Wygenerowano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`;
      doc.text(genDate, 14, 22);

      // Determine Date Range Text
      let rangeText = '';
      const now = new Date();
      if (dateRange === 'today') {
         rangeText = `Zakres: ${format(now, 'dd.MM.yyyy')}`;
      } else if (dateRange === 'yesterday') {
         rangeText = `Zakres: ${format(subDays(now, 1), 'dd.MM.yyyy')}`;
      } else if (dateRange === 'week') {
         rangeText = `Zakres: ${format(subDays(now, 7), 'dd.MM.yyyy')} - ${format(now, 'dd.MM.yyyy')}`;
      } else if (dateRange === 'custom' && customStart && customEnd) {
         rangeText = `Zakres: ${format(new Date(customStart), 'dd.MM.yyyy')} - ${format(new Date(customEnd), 'dd.MM.yyyy')}`;
      }
      
      // Right align date range
      const pageWidth = doc.internal.pageSize.width;
      const rangeTextWidth = doc.getTextWidth(rangeText);
      doc.text(rangeText, pageWidth - 14 - rangeTextWidth, 22);

      const tableData = visitsWithSignatures.map((v, index) => [
        index + 1,
        format(new Date(v.entry_time), 'yyyy-MM-dd HH:mm'),
        v.visitor_name,
        v.visit_purposes?.name || '',
        v.badges?.badge_number || '',
        v.employees?.name || '',
        '', // Signature
        v.exit_time ? format(new Date(v.exit_time), 'HH:mm') : '',
        v.notes || ''
      ]);

      autoTable(doc, {
        theme: 'grid',
        head: [['Lp.', 'Czas przybycia', 'Imię i nazwisko interesanta', 'Cel wizyty', 'Identyfikator', 'Pracownik przyjmujący', 'Podpis pracownika', 'Czas wyjścia', 'Uwagi']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8, cellPadding: 2, font: 'Roboto', valign: 'middle', overflow: 'linebreak', lineWidth: 0.1 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        columnStyles: {
          6: { cellWidth: 30, minCellHeight: 15 }, 
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const visit = visitsWithSignatures[data.row.index];
            if (visit && visit.signature) {
               try {
                 const dim = data.cell;
                 doc.addImage(visit.signature, 'PNG', dim.x + 0.5, dim.y + 0.5, dim.width - 1, dim.height - 1);
               } catch { /* ignore */ }
            }
          }
        }
      });

      // Summary Stats
      const totalVisits = visitsWithSignatures.length;
      let totalDurationMins = 0;
      let completedCount = 0;
      
      visitsWithSignatures.forEach(v => {
         if (v.exit_time) {
            totalDurationMins += (new Date(v.exit_time).getTime() - new Date(v.entry_time).getTime()) / 60000;
            completedCount++;
         }
      });
      
      const avgDurationMins = completedCount > 0 ? Math.round(totalDurationMins / completedCount) : 0;
      const avgH = Math.floor(avgDurationMins / 60);
      const avgM = avgDurationMins % 60;
      const avgDurationText = `${avgH}h ${avgM}m`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setFontSize(10);
      doc.setFont('Roboto', 'bold');
      doc.text('Podsumowanie:', 14, finalY);
      doc.setFont('Roboto', 'normal');
      doc.text(`Liczba wizyt w zakresie: ${totalVisits}`, 14, finalY + 5);
      doc.text(`Średni czas trwania wizyty: ${avgDurationText}`, 14, finalY + 10);

      doc.save(`historia_wizyt_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Szukaj..."
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
          <button onClick={exportToPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Eksportuj
          </button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden min-h-125 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Brak danych</h3>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Rozpoczęcie</th>
                    <th className="px-6 py-4">Zakończenie</th>
                    <th className="px-6 py-4">Interesant</th>
                    <th className="px-6 py-4">Pracownik</th>
                    <th className="px-6 py-4">Cel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedVisits.map((visit) => (
                    <tr key={visit.id} onClick={() => setSelectedVisit(visit)} className="hover:bg-muted/10 transition-colors cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className={`w-3 h-3 rounded-full ${visit.exit_time ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} title={visit.exit_time ? "Zakończona" : "W trakcie"}></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{format(new Date(visit.entry_time), 'HH:mm')}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(visit.entry_time), 'dd.MM.yyyy')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {visit.exit_time ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{format(new Date(visit.exit_time), 'HH:mm')}</span>
                              {visit.is_system_exit && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">SYS</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{format(new Date(visit.exit_time), 'dd.MM.yyyy')}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground italic">-</span>}
                      </td>
                      <td className="px-6 py-4"><span className="font-semibold text-foreground">{visit.visitor_name}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-foreground">{visit.employees?.name}</span>
                          <span className="text-xs text-muted-foreground">{visit.employees?.departments?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">{visit.visit_purposes?.name}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
                 <button onClick={(e) => {e.stopPropagation(); setPage(p => Math.max(1, p - 1))}} disabled={page === 1} className="p-2 border rounded disabled:opacity-50"><ChevronLeft className="w-4 h-4"/></button>
                 <span className="text-xs">Strona {page} z {totalPages}</span>
                 <button onClick={(e) => {e.stopPropagation(); setPage(p => Math.min(totalPages, p + 1))}} disabled={page === totalPages} className="p-2 border rounded disabled:opacity-50"><ChevronRight className="w-4 h-4"/></button>
              </div>
            )}
          </>
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

      {selectedVisit && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                       <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Szczegóły Wizyty</h2>
                    </div>
                 </div>
                 <button 
                   onClick={() => setSelectedVisit(null)}
                   className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                 >
                    <X className="w-6 h-6" />
                 </button>
              </div>

              {/* Body - 3 Column Grid */}
              <div className="p-6 bg-white">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    
                    {/* Column 1: Visitor & Context */}
                    <div className="p-6 space-y-6 bg-slate-50/30">
                       <div className="flex items-center gap-2 mb-4">
                          <User className="w-4 h-4 text-indigo-500" />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Interesant</h3>
                       </div>

                       <div>
                          <div className="text-xs text-slate-400 mb-1">Imię i Nazwisko</div>
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

                       {selectedVisit.notes && (
                           <div className="pt-2">
                              <div className="text-xs text-slate-400 mb-1">Uwagi / Firma</div>
                              <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-lg text-sm text-amber-900 italic">
                                 &quot;{selectedVisit.notes}&quot;
                              </div>
                           </div>
                       )}
                    </div>

                    {/* Column 2: Time & Status */}
                    <div className="p-6 space-y-6 bg-white">
                       <div className="flex items-center gap-2 mb-4">
                          <Clock className="w-4 h-4 text-indigo-500" />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Czas i Status</h3>
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
                          <div className="flex justify-between items-end">
                             <div>
                                <div className="text-xs text-slate-400 mb-1">Całkowity czas</div>
                                <div className="text-lg font-medium text-slate-700">
                                   {selectedVisit.exit_time 
                                     ? `${Math.floor((new Date(selectedVisit.exit_time).getTime() - new Date(selectedVisit.entry_time).getTime()) / 60000)} min`
                                     : '-'}
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Column 3: Employees & Sign */}
                    <div className="p-6 space-y-6 bg-slate-50/30">
                       <div className="flex items-center gap-2 mb-4">
                          <Building2 className="w-4 h-4 text-indigo-500" />
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Pracownik</h3>
                       </div>

                       <div className="space-y-4">
                           {/* Entry Host */}
                           <div className="flex gap-3 items-start">
                              <div className="mt-1 p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                                 <User className="w-3 h-3" />
                              </div>
                              <div>
                                 <div className="text-xs text-slate-400">Wpuszczający</div>
                                 <div className="font-semibold text-slate-900 text-sm">{selectedVisit.employees?.name}</div>
                                 <div className="text-xs text-slate-500">{selectedVisit.employees?.departments?.name}</div>
                              </div>
                           </div>
                           
                           {/* Exit Host */}
                           {selectedVisit.exit_time && (
                              <div className="flex gap-3 items-start">
                                 <div className="mt-1 p-1.5 bg-slate-200 text-slate-600 rounded-md">
                                    <LogOut className="w-3 h-3" />
                                 </div>
                                 <div>
                                    <div className="text-xs text-slate-400">Wypuszczający</div>
                                    <div className="font-semibold text-slate-900 text-sm">
                                       {selectedVisit.is_system_exit 
                                         ? <span className="text-red-600">SYSTEM</span>
                                         : (selectedVisit.exit_employees?.name || "Brak danych")}
                                    </div>
                                 </div>
                              </div>
                           )}
                       </div>

                       {/* Signature Compact */}
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

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end items-center">
                 <button 
                   onClick={() => setSelectedVisit(null)}
                   className="px-8 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm text-sm"
                 >
                    Zamknij
                 </button>
              </div>
           </div>
         </div>
      )}
    </div>
  );
}