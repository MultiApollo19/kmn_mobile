'use client';

import Link from 'next/link';
import { FileText, AlertTriangle, Clock, ChevronRight } from 'lucide-react';

export default function ReportsDashboard() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Raporty</h1>
        <p className="text-slate-500 mt-1">Wybierz rodzaj raportu, który chcesz wygenerować.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* History Card */}
        <Link 
          href="/admin/reports/history"
          className="group relative overflow-hidden bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-32 h-32 -mr-8 -mt-8 text-indigo-600" />
          </div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
              <FileText className="w-7 h-7" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">Pełna Historia Wizyt</h2>
            <p className="text-slate-500 mb-8 flex-1">
              Przeglądaj wszystkie zarejestrowane wizyty.
              Dostęp do pełnego archiwum.
            </p>
            
            <div className="flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
              Przejdź do raportu <ChevronRight className="w-5 h-5 ml-1" />
            </div>
          </div>
        </Link>

        {/* System Exits Card */}
        <Link 
          href="/admin/reports/system-exits"
          className="group relative overflow-hidden bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-32 h-32 -mr-8 -mt-8 text-red-600" />
          </div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-6 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-red-700 transition-colors">Wizyty zakończone przez system</h2>
            <p className="text-slate-500 mb-8 flex-1">
              Lista pracowników, którzy zapomnieli odnotować wyjście gościa.
              Wizyty zamknięte automatycznie przez system po godzinach pracy.
            </p>
            
            <div className="flex items-center text-red-600 font-semibold group-hover:translate-x-2 transition-transform">
              Przejdź do raportu <ChevronRight className="w-5 h-5 ml-1" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}