'use client';

import { useEffect } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Settings, Bell, Search, LogOut, Loader2, Building2, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/src/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Menu</div>
          <NavItem href="/admin" icon={<LayoutDashboard size={20} />} label="Pulpit" active={pathname === '/admin'} />
          <NavItem href="/admin/employees" icon={<Users size={20} />} label="Pracownicy" active={pathname?.startsWith('/admin/employees')} />
          <NavItem href="/admin/departments" icon={<Building2 size={20} />} label="Działy" active={pathname?.startsWith('/admin/departments')} />
          <NavItem href="/admin/logs" icon={<ClipboardList size={20} />} label="Logi" active={pathname?.startsWith('/admin/logs')} />
          <NavItem href="/admin/reports" icon={<FileText size={20} />} label="Raportowanie" active={pathname?.startsWith('/admin/reports')} />
          
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-8 mb-2 px-2">System</div>
          <NavItem href="/admin/settings" icon={<Settings size={20} />} label="Ustawienia" active={pathname?.startsWith('/admin/settings')} />
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
        {/* Top Header */}
        <header className="bg-card border-b border-border h-16 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4 ml-auto">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Szukaj..." 
                className="bg-muted/50 border border-input rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-64 transition-all"
              />
            </div>
            <button className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
            </button>
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
