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
  MapPin,
  CalendarRange
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import Image from 'next/image';

type VisitHistory = {
  id: number;
  entry_time: string;
  exit_time: string | null;
  visitor_name: string;
  notes: string | null;
  signature: string | null;
  employees: {
    name: string;
    departments: {
      name: string;
    } | null;
  } | null;
  exit_employees: {
    name: string;
  } | null;
  visit_purposes: {
    name: string;
  } | null;
  badges: {
    badge_number: string;
  } | null;
};

export default function ReportsPage() {
  const [visits, setVisits] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filtering State
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showDateModal, setShowDateModal] = useState(false);
  
  // Details Modal
  const [selectedVisit, setSelectedVisit] = useState<VisitHistory | null>(null);

  // Pagination
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
          signature,
          employees:employees!employee_id (
            name,
            departments (
              name
            )
          ),
          exit_employees:employees!exit_employee_id (
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
        query = query.gte('entry_time', startOfDay(now).toISOString());
      } else if (dateRange === 'yesterday') {
        const yesterday = subDays(now, 1);
        query = query
          .gte('entry_time', startOfDay(yesterday).toISOString())
          .lte('entry_time', endOfDay(yesterday).toISOString());
      } else if (dateRange === 'week') {
        query = query.gte('entry_time', subDays(now, 7).toISOString());
      } else if (dateRange === 'custom' && customStart && customEnd) {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        // Ensure valid dates
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
           query = query
            .gte('entry_time', startOfDay(start).toISOString())
            .lte('entry_time', endOfDay(end).toISOString());
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Client-side sorting: Active (null exit_time) first, then by entry_time desc
      const sortedData = (data as unknown as VisitHistory[]).sort((a, b) => {
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

  // Client-side filtering
  const filteredVisits = visits.filter(visit => {
    const searchLower = searchTerm.toLowerCase();
    return (
      visit.visitor_name.toLowerCase().includes(searchLower) ||
      visit.employees?.name.toLowerCase().includes(searchLower) ||
      visit.notes?.toLowerCase().includes(searchLower) ||
      visit.badges?.badge_number.toLowerCase().includes(searchLower)
    );
  });

  // Client-side pagination logic
  const totalPages = Math.ceil(filteredVisits.length / pageSize);
  const paginatedVisits = filteredVisits.slice((page - 1) * pageSize, page * pageSize);

  const exportToPDF = async () => {
    if (!visits.length) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Load fonts
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
      doc.setFont('Roboto'); // Set default font
    } catch (err) {
      console.error('Failed to load font:', err);
    }
    
    // Title
    doc.setFontSize(16);
    doc.text('Raport Wizyt', 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Wygenerowano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 22);

    // Prepare data
    const tableData = visits.map((v, index) => [
      index + 1, // Lp
      format(new Date(v.entry_time), 'yyyy-MM-dd HH:mm'), // Czas przybycia
      v.visitor_name, // Nazwisko i Imię
      v.visit_purposes?.name || '', // Cel
      v.badges?.badge_number || '', // Nr ident
      v.employees?.name || '', // Przyjmujący
      '', // Podpis (placeholder for image)
      v.exit_time ? format(new Date(v.exit_time), 'HH:mm') : '', // Wyjście
      v.notes || '' // Uwagi
    ]);

    autoTable(doc, {
      theme: 'grid',
      head: [['Lp.', 'Czas przybycia\ninteresanta', 'Imię i nazwisko\ninteresanta', 'Cel przybycia\ninteresanta', 'Numer\nidentyfikatora', 'Nazwisko przyjmującego\ninteresanta', 'Podpis przyjmującego\ninteresanta', 'Godzina wyjścia\ninteresanta', 'Uwagi']],
      body: tableData,
      startY: 25,
      styles: { 
        fontSize: 10, 
        cellPadding: 2, 
        font: 'Roboto', 
        valign: 'middle',
        overflow: 'linebreak',
        lineWidth: 0.1,
        lineColor: [100, 100, 100]
      },
      headStyles: { 
        fillColor: [240, 240, 240], 
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        font: 'Roboto', 
        valign: 'middle', 
        halign: 'center',
        lineWidth: 0.1,
        lineColor: [100, 100, 100],
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },  // Lp
        1: { cellWidth: 30, halign: 'center' }, // Czas przybycia
        2: { cellWidth: 40 }, // Imię i nazwisko
        3: { cellWidth: 35 }, // Cel
        4: { cellWidth: 26, halign: 'center' }, // Nr ident
        5: { cellWidth: 40 }, // Nazwisko przyjmującego
        6: { cellWidth: 40, minCellHeight: 25 }, // Podpis (Increased height even more)
        7: { cellWidth: 25, halign: 'center' }, // Godzina wyjścia
        // 8: Uwagi (auto)
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const visit = visits[data.row.index];
          if (visit && visit.signature) {
             try {
               const dim = data.cell;
               const padding = 0.5; // Minimal padding
               doc.addImage(
                 visit.signature, 
                 'PNG', 
                 dim.x + padding, 
                 dim.y + padding, 
                 dim.width - (padding * 2), 
                 dim.height - (padding * 2)
                );
             } catch (err) {
               console.error('Error adding signature to PDF', err);
             }
          }
        }
      }
    });

    // Summary calculation
    const totalVisitors = visits.length;
    
    // Avg duration
    const completedVisits = visits.filter(v => v.exit_time);
    let totalDurationMinutes = 0;
    completedVisits.forEach(v => {
      if (v.exit_time) {
        const start = new Date(v.entry_time).getTime();
        const end = new Date(v.exit_time).getTime();
        totalDurationMinutes += (end - start) / 60000;
      }
    });
    
    const avgDuration = completedVisits.length > 0 
      ? Math.round(totalDurationMinutes / completedVisits.length) 
      : 0;
      
    const avgH = Math.floor(avgDuration / 60);
    const avgM = avgDuration % 60;
    const avgString = `${avgH}h ${avgM}m`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(10);
    doc.text('Podsumowanie:', 14, finalY);
    doc.text(`Liczba interesantów: ${totalVisitors}`, 14, finalY + 5);
    doc.text(`Średnie trwania wizyty: ${avgString}`, 14, finalY + 10);

    doc.save(`raport_wizyt_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleCustomRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      setDateRange('custom');
      setShowDateModal(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header / Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        
        {/* Left: Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Szukaj (nazwisko, pracownik, uwagi)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Right: Filters & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-input">
            <button 
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'today' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Dziś
            </button>
            <button 
              onClick={() => setDateRange('yesterday')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'yesterday' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Wczoraj
            </button>
            <button 
              onClick={() => setDateRange('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${dateRange === 'week' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              7 dni
            </button>
            <button 
              onClick={() => setShowDateModal(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${dateRange === 'custom' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <CalendarRange className="w-3 h-3" />
              Zakres
            </button>
          </div>

          <div className="h-8 w-px bg-border mx-1"></div>

          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Eksportuj raport
          </button>
        </div>
      </div>

      {/* Main Content: Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
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
            <p className="text-sm max-w-xs text-center mt-2">Nie znaleziono wizyt spełniających kryteria wyszukiwania.</p>
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
                    <th className="px-6 py-4">Czas trwania</th>
                    <th className="px-6 py-4">Interesant</th>
                    <th className="px-6 py-4">Pracownik</th>
                    <th className="px-6 py-4">Cel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedVisits.map((visit) => {
                    const duration = visit.exit_time 
                      ? Math.round((new Date(visit.exit_time).getTime() - new Date(visit.entry_time).getTime()) / 60000) 
                      : null;

                    return (
                      <tr 
                        key={visit.id} 
                        onClick={() => setSelectedVisit(visit)}
                        className="hover:bg-muted/10 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className={`w-3 h-3 rounded-full ${visit.exit_time ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} title={visit.exit_time ? "Zakończona" : "W trakcie"}></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                             <span className="font-medium text-foreground">
                              {format(new Date(visit.entry_time), 'HH:mm')}
                            </span>
                             <span className="text-xs text-muted-foreground">
                              {format(new Date(visit.entry_time), 'dd.MM.yyyy')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {visit.exit_time ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {format(new Date(visit.exit_time), 'HH:mm')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(visit.exit_time), 'dd.MM.yyyy')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">-</span>
                          )}
                        </td>
                         <td className="px-6 py-4 text-muted-foreground">
                          {duration ? (
                            <span className="font-medium">{Math.floor(duration / 60)}h {duration % 60}m</span>
                          ) : (
                             <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                               W trakcie
                             </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{visit.visitor_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-foreground">{visit.employees?.name}</span>
                            <span className="text-xs text-muted-foreground">{visit.employees?.departments?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            {visit.visit_purposes?.name}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
                <span className="text-sm text-muted-foreground">
                  Strona <span className="font-medium text-foreground">{page}</span> z <span className="font-medium text-foreground">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPage(p => Math.max(1, p - 1)); }}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-input hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPage(p => Math.min(totalPages, p + 1)); }}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-input hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom Date Range Modal */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-900">Wybierz zakres dat</h3>
              <button 
                onClick={() => setShowDateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCustomRangeSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data początkowa</label>
                <input 
                  type="date" 
                  required
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  max={customEnd || undefined}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data końcowa</label>
                <input 
                  type="date" 
                  required
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart || undefined}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDateModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={!customStart || !customEnd}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Zastosuj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                 <div>
                    <h2 className="text-lg font-bold text-slate-900">Szczegóły wizyty</h2>
                    <p className="text-sm text-slate-500">ID: #{selectedVisit.id}</p>
                 </div>
                 <button 
                   onClick={() => setSelectedVisit(null)}
                   className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                 >
                    <X className="w-5 h-5" />
                 </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Column 1: Time & Status */}
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 h-full">
                           <div className="flex items-center gap-2 text-slate-500 mb-3">
                              <Clock className="w-4 h-4" />
                              <span className="text-xs font-semibold uppercase tracking-wider">Czas i Status</span>
                           </div>
                           
                           <div className="space-y-4">
                              <div>
                                 <div className="text-xs text-slate-500 mb-1">Status wizyty</div>
                                 {selectedVisit.exit_time ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-200 text-slate-700">
                                       Zakończona
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                       <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                                       W trakcie
                                    </span>
                                 )}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <div className="text-xs text-slate-500">Wejście</div>
                                    <div className="font-medium text-slate-900">{format(new Date(selectedVisit.entry_time), 'HH:mm')}</div>
                                    <div className="text-xs text-slate-400">{format(new Date(selectedVisit.entry_time), 'dd.MM.yyyy')}</div>
                                 </div>
                                 {selectedVisit.exit_time && (
                                    <div>
                                       <div className="text-xs text-slate-500">Wyjście</div>
                                       <div className="font-medium text-slate-900">{format(new Date(selectedVisit.exit_time), 'HH:mm')}</div>
                                       <div className="text-xs text-slate-400">{format(new Date(selectedVisit.exit_time), 'dd.MM.yyyy')}</div>
                                    </div>
                                 )}
                              </div>

                              <div>
                                 <div className="text-xs text-slate-500">Czas trwania</div>
                                 <div className="text-xl font-bold text-slate-900">
                                    {selectedVisit.exit_time 
                                       ? Math.ceil((new Date(selectedVisit.exit_time).getTime() - new Date(selectedVisit.entry_time).getTime()) / 60000) + ' min'
                                       : 'Trwa...'}
                                 </div>
                              </div>
                           </div>
                        </div>
                    </div>

                    {/* Column 2: Visitor Details */}
                    <div className="space-y-4">
                        <div className="p-4 bg-white rounded-xl border border-slate-200 h-full shadow-sm">
                           <div className="flex items-center gap-2 text-indigo-500 mb-3">
                              <User className="w-4 h-4" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dane Interesanta</span>
                           </div>

                           <div className="space-y-4">
                              <div>
                                 <div className="text-xs text-slate-500">Imię i nazwisko</div>
                                 <div className="font-bold text-slate-900 text-lg">{selectedVisit.visitor_name}</div>
                              </div>

                              <div className="flex gap-4">
                                 <div className="flex-1">
                                     <div className="text-xs text-slate-500">Cel wizyty</div>
                                     <div className="font-medium text-slate-900">{selectedVisit.visit_purposes?.name}</div>
                                 </div>
                                 <div>
                                     <div className="text-xs text-slate-500">Identyfikator</div>
                                     <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                       {selectedVisit.badges?.badge_number}
                                     </span>
                                 </div>
                              </div>

                              {selectedVisit.notes && (
                                 <div>
                                    <div className="text-xs text-slate-500 mb-1">Uwagi</div>
                                    <div className="text-sm text-slate-700 italic bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                                       &quot;{selectedVisit.notes}&quot;
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                    </div>

                    {/* Column 3: Employee & Signature */}
                    <div className="space-y-4 flex flex-col">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex-1">
                           <div className="flex items-center gap-2 text-indigo-500 mb-3">
                              <Building2 className="w-4 h-4" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pracownik Przyjmujący</span>
                           </div>

                           <div className="space-y-3 mb-6">
                              <div>
                                 <div className="text-xs text-slate-500">Wpuszczający</div>
                                 <div className="font-medium text-slate-900">{selectedVisit.employees?.name}</div>
                              </div>
                              <div>
                                 <div className="text-xs text-slate-500">Dział</div>
                                 <div className="font-medium text-slate-900 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {selectedVisit.employees?.departments?.name}
                                 </div>
                              </div>

                              {selectedVisit.exit_time && (
                                <div className="pt-3 mt-3 border-t border-slate-100">
                                   <div className="text-xs text-slate-500">Wypuszczający</div>
                                   <div className="font-medium text-slate-900 mt-1">
                                      {selectedVisit.exit_employees?.name 
                                        ? (selectedVisit.exit_employees.name === selectedVisit.employees?.name 
                                            ? <span className="text-slate-500 italic text-sm">Ta sama osoba wpuściła i wypuściła</span> 
                                            : selectedVisit.exit_employees.name)
                                        : <span className="text-slate-400 italic text-sm">Brak danych o wypuszczającym</span>}
                                   </div>
                                </div>
                              )}
                           </div>

                           {selectedVisit.signature && (
                              <div className="mt-auto pt-4 border-t border-slate-200">
                                 <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Podpis pracownika</div>
                                 <div className="relative h-48 w-full bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    <Image 
                                      src={selectedVisit.signature} 
                                      alt="Podpis" 
                                      fill
                                      className="object-contain" 
                                    />
                                 </div>
                              </div>
                           )}
                        </div>
                    </div>

                 </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end flex-shrink-0">
                 <button 
                   onClick={() => setSelectedVisit(null)}
                   className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
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
