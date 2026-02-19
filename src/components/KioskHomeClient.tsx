'use client';

import { useAuth } from "@/src/hooks/useAuth";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import {
  LogOut,
  User,
  XCircle,
  History,
  CalendarDays,
  PenTool,
  Save,
  Loader2,
  ChevronRight,
  MoreVertical,
  Edit,
  Clock,
  MapPin
} from "lucide-react";
import Image from "next/image";

// --- Types ---
export interface VisitPurpose {
  id: number;
  name: string;
}

export interface Badge {
  id: number;
  badge_number: string;
  is_active: boolean;
}

const BADGE_COLLATOR = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

const normalizeBadgeNumber = (value: string) => value.trim();

const compareBadgeNumber = (left: string, right: string) =>
  BADGE_COLLATOR.compare(normalizeBadgeNumber(left), normalizeBadgeNumber(right));

interface ActiveVisit {
  id: number;
  entry_time: string;
  visitor_name: string;
  badge: { badge_number: string };
  purpose: { name: string };
  employee: { name: string; departments: { name: string } };
  notes: string;
}

interface KioskHomeClientProps {
  initialPurposes: VisitPurpose[];
  initialBadges: Badge[];
  initialUsedBadgeNumbers: string[];
}

// --- Signature Component ---
const SignaturePad = ({ onEnd, disabled }: { onEnd: (dataUrl: string) => void, disabled: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = ((e as React.MouseEvent).clientX - rect.left) * scaleX;
      y = ((e as React.MouseEvent).clientY - rect.top) * scaleY;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3; // Slightly thicker for better visibility
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; // slate-900
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = ((e as React.MouseEvent).clientX - rect.left) * scaleX;
      y = ((e as React.MouseEvent).clientY - rect.top) * scaleY;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      onEnd(canvasRef.current.toDataURL());
    }
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      onEnd('');
      setHasSignature(false);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-slate-50 rounded-xl border border-slate-200"></div>
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        className="relative z-10 w-full touch-none rounded-xl cursor-crosshair active:cursor-crosshair bg-transparent"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {!hasSignature && (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <span className="text-slate-400 text-sm font-medium bg-slate-50/50 px-3 py-1 rounded-full">
            Miejsce na podpis
          </span>
        </div>
      )}
      {hasSignature && (
        <button 
          type="button" 
          onClick={clear}
          className="absolute top-3 right-3 z-20 p-2 bg-white text-red-500 hover:text-red-500 hover:bg-red-50 rounded-lg shadow-sm border border-slate-200 transition-all"
          title="Wyczyść podpis"
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default function KioskHomeClient({ 
  initialPurposes, 
  initialBadges, 
  initialUsedBadgeNumbers 
}: KioskHomeClientProps) {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Data State - initialized with props
  const [purposes, setPurposes] = useState<VisitPurpose[]>(initialPurposes);
  const [badges, setBadges] = useState<Badge[]>(initialBadges);
  const [usedBadgeNumbers, setUsedBadgeNumbers] = useState<string[]>(initialUsedBadgeNumbers);
  const [activeVisits, setActiveVisits] = useState<ActiveVisit[]>([]);
  
  // loadingData only tracks activeVisits fetching now, since others are pre-loaded
  const [loadingVisits, setLoadingVisits] = useState(true);

  // Form State
  const [visitorName, setVisitorName] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Edit Modal State
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingVisit, setEditingVisit] = useState<ActiveVisit | null>(null);
  const [editVisitorName, setEditVisitorName] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Clock
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch Data (Refreshes everything or fetches missing active visits)
  const fetchData = useCallback(async () => {
    setLoadingVisits(true);
    try {
      // 1. Fetch Purposes (Optional refresh, but we have initial)
      const { data: purposesData } = await supabase
        .from('visit_purposes')
        .select('*')
        .order('name', { ascending: true });
        
      if (purposesData) setPurposes(purposesData);

      // 2. Fetch Badges (Optional refresh)
      const { data: badgesData } = await supabase.from('badges').select('*').eq('is_active', true);
      if (badgesData) setBadges(badgesData);

      // 3. Fetch ALL used badges (global)
      const { data: globalActiveVisits } = await supabase
        .from('visits')
        .select('badge:badges(badge_number)')
        .is('exit_time', null);
      
      if (globalActiveVisits) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const used = globalActiveVisits.map((v: any) => v.badge?.badge_number).filter(Boolean);
        setUsedBadgeNumbers(used);
      }

      // 4. Fetch Active Visits (filtered by user's department)
      if (user?.department) {
        const { data: visitsData, error } = await supabase
          .from('visits')
          .select(`
            id, 
            entry_time, 
            visitor_name, 
            notes,
            badge:badges(badge_number),
            purpose:visit_purposes(name),
            employee:employees!visits_employee_id_fkey!inner(
              name,
              departments!inner(name)
            )
          `)
          .is('exit_time', null)
          .eq('employee.departments.name', user.department)
          .order('entry_time', { ascending: false });

        if (visitsData) {
          setActiveVisits(visitsData as unknown as ActiveVisit[]);
        }
        
        if (error) {
          console.error("Error fetching visits:", JSON.stringify(error, null, 2));
        }
      }

    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoadingVisits(false);
    }
  }, [user?.department]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Derived State
  const sortedBadges = [...badges].sort((a, b) =>
    compareBadgeNumber(a.badge_number, b.badge_number)
  );

  const availableBadges = sortedBadges.filter(b => 
    !usedBadgeNumbers.includes(b.badge_number)
  );
  const showSkeleton = loadingVisits && purposes.length === 0 && badges.length === 0;

  const revalidateCache = async () => {
    try {
      // Revalidate 'visits' (for getGlobalActiveVisits) and 'dashboard' (for admin)
      const secret = process.env.NEXT_PUBLIC_REVALIDATION_TOKEN;
      if (!secret) {
         console.warn("Missing NEXT_PUBLIC_REVALIDATION_TOKEN - skipping revalidation");
         return;
      }
      await fetch(`/api/revalidate?tag=visits&secret=${secret}`);
      await fetch(`/api/revalidate?tag=dashboard&secret=${secret}`);
    } catch (err) {
      console.error('Failed to revalidate cache', err);
    }
  };

  const handleAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !visitorName || !selectedPurpose || !selectedBadge || !signature) {
      alert("Proszę uzupełnić wszystkie wymagane pola i podpisać formularz.");
      return;
    }

    if (selectedPurpose === 'Inne' && notes.trim().length < 3) {
      alert("W przypadku celu wizyty 'Inne', uwagi muszą zawierać co najmniej 3 znaki.");
      return;
    }

    setSubmitting(true);
    try {
      const badgeId = badges.find(b => b.badge_number === selectedBadge)?.id;
      const purposeId = purposes.find(p => p.name === selectedPurpose)?.id;

      if (!badgeId || !purposeId) throw new Error("Invalid selection");

      const { error } = await supabase.from('visits').insert({
        employee_id: user.id,
        visitor_name: visitorName,
        purpose_id: purposeId,
        badge_id: badgeId,
        notes: notes,
        signature: signature
      });

      if (error) throw error;

      // Reset Form
      setVisitorName('');
      setSelectedPurpose('');
      setSelectedBadge('');
      setNotes('');
      setSignature('');
      await fetchData();
      await revalidateCache();

    } catch (err) {
      console.error("Error submitting visit:", err);
      alert("Wystąpił błąd podczas zapisywania wizyty.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async (visitId: number) => {
    if (!confirm("Czy na pewno chcesz zakończyć tę wizytę?")) return;

    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          exit_time: new Date().toISOString(),
          exit_employee_id: user?.id
        })
        .eq('id', visitId);

      if (error) throw error;
      await fetchData();
      await revalidateCache();
    } catch (err) {
      console.error("Error checking out:", err);
      alert("Nie udało się zakończyć wizyty.");
    }
  };

  const handleEditClick = (visit: ActiveVisit) => {
    setEditingVisit(visit);
    setEditVisitorName(visit.visitor_name);
    setEditPurpose(visit.purpose.name);
    setEditBadge(visit.badge.badge_number);
    setEditNotes(visit.notes || '');
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingVisit) return;

    if (editPurpose === 'Inne' && editNotes.trim().length < 3) {
      alert("W przypadku celu wizyty 'Inne', uwagi muszą zawierać co najmniej 3 znaki.");
      return;
    }

    setSavingEdit(true);
    try {
      const purposeId = purposes.find(p => p.name === editPurpose)?.id;
      const badgeId = badges.find(b => b.badge_number === editBadge)?.id;
      
      const { error } = await supabase
        .from('visits')
        .update({ 
          visitor_name: editVisitorName,
          notes: editNotes,
          purpose_id: purposeId,
          badge_id: badgeId
        })
        .eq('id', editingVisit.id);

      if (error) throw error;
      
      await fetchData();
      await revalidateCache();
      setEditingVisit(null);
    } catch (err) {
      console.error("Error updating visit:", err);
      alert("Nie udało się zaktualizować wizyty.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (authLoading || !user) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
       <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[20px_20px] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Top Navigation */}
      <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-400 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            
            {/* Logo Area */}
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-24 overflow-hidden rounded-xl">
                 <Image 
                  src="/Logo.png" 
                  alt="Company Logo" 
                  fill
                  className="object-contain"
                  priority
                 />
              </div>
              <div className="hidden md:block">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">Rejestr interesantów</h1>
              </div>
            </div>

            {/* Right Side Info */}
            <div className="flex items-center gap-4">
              {/* Time Display */}
              <div className="hidden lg:flex flex-col items-end border-r border-slate-200 pr-4">
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {currentTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {currentTime?.toLocaleDateString([], { day: 'numeric', month: 'long' })}
                </span>
              </div>

              {/* User Profile */}
              <div className="flex items-center gap-2 pl-1">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                      {user.department}
                    </span>
                  </div>
                </div>
                <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-inner">
                  {user.name.charAt(0)}
                </div>
                <button 
                  onClick={logout}
                  className="ml-1 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                  title="Wyloguj się"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-400 mx-auto h-[calc(100vh-3.5rem)] p-3 sm:p-4 lg:p-5 overflow-hidden">
        {showSkeleton ? (
          <div className="grid h-full grid-cols-1 lg:grid-cols-12 gap-4 items-stretch animate-pulse">
            <div className="lg:col-span-6 xl:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-56 bg-slate-200 rounded" />
                <div className="h-12 w-full bg-slate-200 rounded-xl" />
                <div className="h-12 w-full bg-slate-200 rounded-xl" />
                <div className="h-12 w-full bg-slate-200 rounded-xl" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                <div className="h-5 w-32 bg-slate-200 rounded" />
                <div className="h-24 w-full bg-slate-200 rounded-xl" />
              </div>
            </div>
            <div className="lg:col-span-6 xl:col-span-7 h-full">
              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 h-full">
                <div className="h-5 w-48 bg-slate-200 rounded" />
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-full bg-slate-200 rounded" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 lg:grid-cols-12 gap-4 items-stretch overflow-hidden">
          
          {/* --- LEFT COLUMN: Admission Form --- */}
          <div className="lg:col-span-6 xl:col-span-5 h-full min-h-0">
            <div className="bg-white rounded-2xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden h-full flex flex-col">
              <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Nowa Wizyta</h2>
                  <p className="text-xs text-slate-500">Wprowadź dane gościa</p>
                </div>
              </div>

              <div className="p-4 flex-1 min-h-0 overflow-y-auto">
                <form onSubmit={handleAdmission} className="space-y-4">
                  
                  {/* Visitor Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">
                      Kogo wpuszczamy? <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        value={visitorName}
                        onChange={e => setVisitorName(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                        placeholder="Imię i nazwisko interesanta"
                        required
                      />
                    </div>
                  </div>

                  {/* Purpose & Badge Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">
                        Cel wizyty <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedPurpose}
                          onChange={e => setSelectedPurpose(e.target.value)}
                          className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none font-medium cursor-pointer"
                          required
                        >
                          <option value="" disabled>Wybierz...</option>
                          {purposes.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">
                        Identyfikator <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedBadge}
                          onChange={e => setSelectedBadge(e.target.value)}
                          className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none font-medium cursor-pointer"
                          required
                        >
                          <option value="" disabled>Wybierz...</option>
                          {availableBadges.map(b => (
                            <option key={b.id} value={b.badge_number}>{b.badge_number}</option>
                          ))}
                        </select>
                         <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">
                      Uwagi {selectedPurpose === 'Inne' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal text-xs">(opcjonalne)</span>}
                    </label>
                    <textarea 
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-medium"
                      placeholder="Np. Firma, nr. legitymacji, opis..."
                    />
                  </div>

                  {/* Signature */}
                  <div className="space-y-2 pt-2">
                     <label className="text-sm font-semibold text-slate-700 ml-1 flex justify-between">
                        <span>Podpis Pracownika</span>
                        <span className="text-xs text-slate-400 font-normal">Wymagane</span>
                     </label>
                     <SignaturePad 
                      key={submitting ? 'submitted' : 'editing'} 
                      onEnd={setSignature} 
                      disabled={submitting} 
                     />
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={submitting || !visitorName || !selectedPurpose || !selectedBadge || !signature || (selectedPurpose === 'Inne' && notes.trim().length < 3)}
                    className="group relative w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none overflow-hidden"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                      <span>Zatwierdź wejście</span>
                    </div>
                    {/* Shine effect */}
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-linear-to-r from-transparent to-white opacity-10 group-hover:animate-shine" />
                  </button>

                </form>
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: Active Feed --- */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Aktywne Wizyty</h2>
                <p className="text-sm text-slate-500 mt-0.5">Lista gości przebywających w Twoim dziale</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchData} 
                  className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-slate-600 transition-all shadow-sm hover:shadow-md"
                  title="Odśwież listę"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {loadingVisits ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-slate-100 shadow-sm"></div>
                  ))}
                </div>
              ) : activeVisits.length === 0 ? (
                <div className="flex h-full min-h-64 flex-col items-center justify-center py-10 bg-white rounded-2xl border border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <User className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Brak aktywnych wizyt</h3>
                  <p className="text-slate-500 max-w-xs text-center mt-1 text-sm">
                    Wszystkie wizyty w Twoim dziale zostały zakończone. Użyj formularza po lewej, aby dodać nową.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeVisits.map((visit) => (
                    <div 
                      key={visit.id} 
                      className="group bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col"
                    >
                      {/* Status Stripe */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>

                      <div className="p-5 pl-7 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-24 h-12 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold text-md border border-slate-200 transition-colors">
                                {visit.badge.badge_number}
                              </span>
                              <div>
                                <h3 className="font-bold text-lg text-slate-900 leading-tighttransition-colors">
                                  {visit.visitor_name}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    {visit.purpose.name}
                                  </span>
                                </div>
                              </div>
                           </div>
                           
                           {/* Context Menu */}
                           <div className="relative">
                             <button 
                               onClick={() => setOpenMenuId(openMenuId === visit.id ? null : visit.id)}
                               className="text-slate-300 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                             >
                               <MoreVertical className="w-5 h-5" />
                             </button>
                             
                             {openMenuId === visit.id && (
                               <>
                                 <div 
                                   className="fixed inset-0 z-10" 
                                   onClick={() => setOpenMenuId(null)} 
                                 />
                                 <div className="absolute right-0 top-8 z-20 w-32 bg-white rounded-lg shadow-xl border border-slate-100 py-1 overflow-hidden">
                                   <button 
                                     onClick={() => handleEditClick(visit)}
                                     className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium flex items-center gap-2"
                                   >
                                     <Edit className="w-4 h-4" />
                                     Edytuj
                                   </button>
                                 </div>
                               </>
                             )}
                           </div>
                        </div>

                        <div className="space-y-2 mb-6 flex-1">
                           <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span>Wejście: <span className="font-semibold text-slate-700">{new Date(visit.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></span>
                           </div>
                           <div className="flex items-center gap-2 text-sm text-slate-500">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              <span>Wpuścił: <span className="font-semibold text-slate-700">{visit.employee.name}</span></span>
                           </div>
                           {visit.notes ? (
                             <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800 italic">
                               &quot;{visit.notes}&quot;
                             </div>
                           ): (
                             <div className="mt-3 p-5 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800 italic">
                              
                            </div>
                          )
                          }
                        </div>

                        <button 
                          onClick={() => handleCheckout(visit.id)}
                          className="w-full py-2.5 rounded-xl bg-white border-2 border-emerald-500  text-slate-600 font-semibold transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <LogOut className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                          <span>Zakończ wizytę</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingVisit && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-900">Edycja wizyty</h3>
              <button 
                onClick={() => setEditingVisit(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Imię i nazwisko interesanta
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={editVisitorName}
                    onChange={e => setEditVisitorName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Cel wizyty
                </label>
                <div className="relative">
                  <select 
                    value={editPurpose}
                    onChange={e => setEditPurpose(e.target.value)}
                    className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none font-medium cursor-pointer"
                  >
                    <option value="" disabled>Wybierz...</option>
                    {purposes.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Identyfikator
                </label>
                <div className="relative">
                  <select 
                    value={editBadge}
                    onChange={e => setEditBadge(e.target.value)}
                    className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none font-medium cursor-pointer"
                  >
                    {sortedBadges.filter(b => 
                      // Show badge if it is NOT used by any OTHER visit (allow current visit's badge)
                      !usedBadgeNumbers.includes(b.badge_number) || b.badge_number === editingVisit.badge.badge_number
                    ).map(b => (
                      <option key={b.id} value={b.badge_number}>{b.badge_number}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Uwagi {editPurpose === 'Inne' ? <span className="text-red-500">*</span> : null}
                </label>
                <textarea 
                  rows={3}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none font-medium"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingVisit(null)}
                  className="flex-1 py-3 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editVisitorName || (editPurpose === 'Inne' && editNotes.trim().length < 3)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {savingEdit ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>Zapisz</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}