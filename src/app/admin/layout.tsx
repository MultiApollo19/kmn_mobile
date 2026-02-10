'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Settings, Search, LogOut, Loader2, Building2, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/src/lib/utils';
import { createActorClient } from '@/src/lib/supabaseActor';
import NotificationsClient from '@/src/components/NotificationsClient';

type SearchResult = {
  id: string;
  label: string;
  href: string;
  kind: 'page' | 'employee' | 'department' | 'purpose' | 'badge';
  keywords?: string[];
  meta?: string;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, sessionWarningSeconds, extendSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dataResults, setDataResults] = useState<SearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const searchCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Derive authorization from current state instead of setting it inside an effect
  useEffect(() => {
    if (loading) return;
    if (pathname === '/admin/login') return;
    if (!user) {
      router.replace('/admin/login');
      return;
    }
    if (user.role !== 'admin' && user.role !== 'department_admin') {
      router.replace('/');
      return;
    }
  }, [user, loading, pathname, router]);

  const isAuthorized = !loading && (pathname === '/admin/login' || (!!user && (user.role === 'admin' || user.role === 'department_admin')));

  const navSections = useMemo(
    () => [
      {
        title: 'Menu',
        items: [
          { href: '/admin', label: 'Pulpit', icon: <LayoutDashboard size={20} />, keywords: ['dashboard', 'start', 'statystyki', 'pulpit'] },
          { href: '/admin/employees', label: 'Pracownicy', icon: <Users size={20} />, keywords: ['personel', 'użytkownicy', 'role', 'pin'] },
          { href: '/admin/departments', label: 'Działy', icon: <Building2 size={20} />, keywords: ['departamenty', 'struktura', 'organizacja'] },
          { href: '/admin/logs', label: 'Logi', icon: <ClipboardList size={20} />, keywords: ['audyt', 'zdarzenia', 'historia zmian'] },
          { href: '/admin/reports', label: 'Raportowanie', icon: <FileText size={20} />, keywords: ['raporty', 'eksport', 'pdf'] },
        ]
      },
      {
        title: 'System',
        items: [
          { href: '/admin/settings', label: 'Ustawienia', icon: <Settings size={20} />, keywords: ['konfiguracja', 'cele wizyt', 'identyfikatory'] },
        ]
      }
    ],
    []
  );

  const pageMeta = useMemo(() => (
    {
      '/admin': {
        title: 'Pulpit',
        description: 'Podgląd statystyk i aktywnych wizyt.'
      },
      '/admin/employees': {
        title: 'Pracownicy',
        description: 'Zarządzanie personelem i uprawnieniami.'
      },
      '/admin/departments': {
        title: 'Działy',
        description: 'Zarządzanie strukturą organizacyjną firmy.'
      },
      '/admin/logs': {
        title: 'Logi zdarzeń',
        description: 'Przegląd zmian i aktywności w systemie.'
      },
      '/admin/reports': {
        title: 'Raporty',
        description: 'Wybierz rodzaj raportu do wygenerowania.'
      },
      '/admin/reports/history': {
        title: 'Pełna historia wizyt',
        description: 'Przeglądaj wszystkie zarejestrowane wizyty.'
      },
      '/admin/reports/system-exits': {
        title: 'Wizyty zakończone przez system',
        description: 'Lista wizyt zamkniętych automatycznie przez system.'
      },
      '/admin/settings': {
        title: 'Ustawienia systemu',
        description: 'Zarządzaj konfiguracją i ustawieniami aplikacji.'
      }
    }
  ), []);

  const activePageMeta = useMemo(() => {
    if (!pathname) return null;
    const direct = pageMeta[pathname as keyof typeof pageMeta];
    if (direct) return direct;
    const matched = Object.entries(pageMeta).find(([route]) => pathname.startsWith(`${route}/`));
    return matched ? matched[1] : null;
  }, [pageMeta, pathname]);

  const formatSessionCountdown = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const routeItems = useMemo<SearchResult[]>(() =>
    navSections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.href,
        label: item.label,
        href: item.href,
        keywords: item.keywords,
        kind: 'page',
        meta: undefined
      }))
    ), [navSections]
  );

  const filteredRouteItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return [];
    return routeItems
      .filter((item) => {
        const haystack = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 4);
  }, [routeItems, searchValue]);

  const combinedSuggestions = useMemo(() => {
    const query = searchValue.trim();
    if (!query) return [];
    const merged = [...filteredRouteItems, ...dataResults];
    const seen = new Set<string>();
    return merged.filter((item) => {
      const key = `${item.kind}-${item.href}-${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dataResults, filteredRouteItems, searchValue]);

  const handleSearchNavigate = (href: string) => {
    setSearchValue('');
    setIsSearchOpen(false);
    setActiveIndex(-1);
    router.push(href);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen) return;
    if (combinedSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, combinedSuggestions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const target = combinedSuggestions[activeIndex] || combinedSuggestions[0];
      if (target) handleSearchNavigate(target.href);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsSearchOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    if (!user) return;
    const query = searchValue.trim();
    if (query.length < 2) {
      setDataResults([]);
      setIsSearchLoading(false);
      return;
    }

    setIsSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const client = createActorClient(user);
        const [employeesRes, departmentsRes, purposesRes, badgesRes] = await Promise.all([
          client.from('employees').select('id, name').ilike('name', `%${query}%`).limit(5),
          client.from('departments').select('id, name').ilike('name', `%${query}%`).limit(5),
          client.from('visit_purposes').select('id, name').ilike('name', `%${query}%`).limit(5),
          client.from('badges').select('id, badge_number').ilike('badge_number', `%${query}%`).limit(5)
        ]);

        const nextResults: SearchResult[] = [];

        if (employeesRes.data) {
          nextResults.push(...employeesRes.data.map((employee) => ({
            id: `employee-${employee.id}`,
            label: employee.name,
            href: `/admin/employees?search=${encodeURIComponent(employee.name)}`,
            kind: 'employee' as const,
            meta: 'Pracownik'
          })));
        }

        if (departmentsRes.data) {
          nextResults.push(...departmentsRes.data.map((department) => ({
            id: `department-${department.id}`,
            label: department.name,
            href: `/admin/departments?search=${encodeURIComponent(department.name)}`,
            kind: 'department' as const,
            meta: 'Dział'
          })));
        }

        if (purposesRes.data) {
          nextResults.push(...purposesRes.data.map((purpose) => ({
            id: `purpose-${purpose.id}`,
            label: purpose.name,
            href: `/admin/settings?tab=purposes&search=${encodeURIComponent(purpose.name)}`,
            kind: 'purpose' as const,
            meta: 'Cel wizyty'
          })));
        }

        if (badgesRes.data) {
          nextResults.push(...badgesRes.data.map((badge) => ({
            id: `badge-${badge.id}`,
            label: badge.badge_number,
            href: `/admin/settings?tab=identifiers&search=${encodeURIComponent(badge.badge_number)}`,
            kind: 'badge' as const,
            meta: 'Identyfikator'
          })));
        }

        setDataResults(nextResults.slice(0, 8));
      } catch {
        setDataResults([]);
      } finally {
        setIsSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchValue, user]);

  // If on login page, render children without layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show loading or blank while checking auth
  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted/20 flex font-sans text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border shrink-0 hidden md:flex flex-col fixed inset-y-0 left-0">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight">Panel administracyjny</h1>
          <p className="text-xs text-muted-foreground mt-1">System zarządzania interesantami</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                {section.title}
              </div>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const isActive = item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname === item.href || pathname?.startsWith(`${item.href}/`);

                  return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={isActive}
                  />
                  );
                })}
              </div>
              {section.title !== navSections[navSections.length - 1].title && (
                <div className="mt-8"></div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.role === 'admin' ? 'Administrator' : 'Kierownik'}</div>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            <span>Wyloguj</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:pl-64">
        {sessionWarningSeconds !== null && sessionWarningSeconds > 0 && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm w-[calc(100%-3rem)] rounded-xl border border-amber-200 bg-amber-50 text-amber-950 shadow-lg p-4 flex flex-col gap-3">
            <div className="text-sm font-medium">
              Sesja wygasnie za {formatSessionCountdown(sessionWarningSeconds)}. Zapisz zmiany, aby uniknac utraty danych.
            </div>
            <button
              type="button"
              onClick={extendSession}
              className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-amber-300 bg-white text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              Przedluz sesje
            </button>
          </div>
        )}
        {/* Top Header */}
        <header className="bg-card border-b border-border min-h-16 flex items-center justify-between px-6 lg:px-8 gap-6">
          <div className="min-w-0">
            {activePageMeta && (
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
                  {activePageMeta.title}
                </h1>
                <p className="text-sm text-muted-foreground truncate">
                  {activePageMeta.description}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="relative hidden sm:block w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Szukaj..."
                value={searchValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSearchValue(nextValue);
                  setIsSearchOpen(!!nextValue.trim());
                  setActiveIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  if (searchCloseTimer.current) {
                    clearTimeout(searchCloseTimer.current);
                    searchCloseTimer.current = null;
                  }
                  if (searchValue.trim()) setIsSearchOpen(true);
                }}
                onBlur={() => {
                  searchCloseTimer.current = setTimeout(() => {
                    setIsSearchOpen(false);
                    setActiveIndex(-1);
                  }, 120);
                }}
                className="bg-muted/50 border border-input rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full transition-all"
                role="combobox"
                aria-expanded={isSearchOpen}
                aria-controls="admin-search-suggestions"
                aria-autocomplete="list"
              />
              {isSearchOpen && (
                <div
                  id="admin-search-suggestions"
                  role="listbox"
                  className="absolute top-11 left-0 right-0 z-20 rounded-lg border border-border bg-card shadow-lg p-1"
                >
                  {combinedSuggestions.length === 0 && !isSearchLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Brak wyników</div>
                  )}
                  {isSearchLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Szukam...</div>
                  )}
                  {combinedSuggestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                        index === activeIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSearchNavigate(item.href)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        {item.meta && <span className="text-xs opacity-70">{item.meta}</span>}
                      </div>
                      <span className="text-xs opacity-70">{item.kind === 'page' ? item.href : 'Wynik'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <NotificationsClient />
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto">
          <div className="admin-page">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, href, active = false }: { icon: React.ReactNode, label: string, href: string, active?: boolean }) {
  return (
    <Link 
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
        active 
          ? "bg-primary text-primary-foreground shadow-sm" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
