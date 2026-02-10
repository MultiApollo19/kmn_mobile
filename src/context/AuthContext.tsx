'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useRouter } from 'next/navigation';


export type UserType = {
  id: string | number;
  name: string;
  role: string;
  department?: string;
  type: 'employee';
};

type AuthContextType = {
  user: UserType | null;
  loading: boolean;
  loginWithPin: (pin: string, redirectPath?: string) => Promise<UserType | void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const logoutTimer = useRef<number | null>(null);
  const activityHandlerRef = useRef<(() => void) | null>(null);

  const clearLogoutTimer = () => {
    if (logoutTimer.current) {
      window.clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
  };

  const performLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('kmn_auth');
    setUser(null);
    try { router.push('/login'); } catch {}
  };

  const scheduleLogout = (ms: number) => {
    clearLogoutTimer();
    logoutTimer.current = window.setTimeout(() => {
      void performLogout();
    }, ms);
  };

  const isAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/admin');
  };

  const setupInactivityTracking = (idleMs: number) => {
    const refreshExpiry = () => {
      const stored = localStorage.getItem('kmn_auth');
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as { user: UserType; expiresAt?: number } | UserType;
        if (parsed && typeof parsed === 'object' && 'user' in parsed) {
          const nextExpiresAt = Date.now() + idleMs;
          localStorage.setItem('kmn_auth', JSON.stringify({ user: parsed.user, expiresAt: nextExpiresAt }));
          scheduleLogout(idleMs);
        }
      } catch {
        // Ignore invalid storage
      }
    };

    const handler = () => refreshExpiry();
    activityHandlerRef.current = handler;

    window.addEventListener('mousemove', handler, { passive: true });
    window.addEventListener('mousedown', handler, { passive: true });
    window.addEventListener('keydown', handler);
    window.addEventListener('touchstart', handler, { passive: true });
    window.addEventListener('scroll', handler, { passive: true });
  };

  const teardownInactivityTracking = () => {
    const handler = activityHandlerRef.current;
    if (!handler) return;
    window.removeEventListener('mousemove', handler);
    window.removeEventListener('mousedown', handler);
    window.removeEventListener('keydown', handler);
    window.removeEventListener('touchstart', handler);
    window.removeEventListener('scroll', handler);
    activityHandlerRef.current = null;
  };

  // Restore session from localStorage or Supabase session
  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Check Supabase Session first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // We have a session, but we need the rich user details (name, role from DB)
        // We can try to recover it from localStorage as a cache, or fetch it.
        // For simplicity/robustness, we'll assume localStorage is the source of truth for UI state
        // and Supabase Session is the source of truth for RLS.
        const stored = localStorage.getItem('kmn_auth');
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as { user: UserType; expiresAt?: number } | UserType;
            // New format: { user, expiresAt }
            if (parsed && typeof parsed === 'object' && 'user' in parsed) {
              const p = parsed as { user: UserType; expiresAt?: number };
              if (p.expiresAt && typeof p.expiresAt === 'number') {
                if (Date.now() > p.expiresAt) {
                  localStorage.removeItem('kmn_auth');
                  setUser(null);
                } else {
                  setUser(p.user);
                  const ms = p.expiresAt - Date.now();
                  if (ms > 0) {
                    scheduleLogout(ms);
                  }
                }
              } else {
                setUser(p.user);
              }
            } else {
              // Backwards compatibility: stored is plain UserType
              setUser(parsed as UserType);
            }
          } catch {
            // Invalid storage
          }
        }
      } else {
        // No session, ensure no user state
        localStorage.removeItem('kmn_auth');
        setUser(null);
      }
      setLoading(false);
    };

    initializeAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
       if (!session) {
         setUser(null);
         localStorage.removeItem('kmn_auth');
       }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) {
      teardownInactivityTracking();
      clearLogoutTimer();
      return;
    }

    const idleMs = 60 * 1000;
    if (isAdminRoute()) {
      teardownInactivityTracking();
      return;
    }

    setupInactivityTracking(idleMs);
    scheduleLogout(idleMs);

    return () => {
      teardownInactivityTracking();
    };
  }, [user]);

  const loginWithPin = async (pin: string, redirectPath: string = '/') => {
    // 1. Verify PIN via RPC (Secure Lookup)
    // The RPC checks the PIN against the bcrypt hash in the database.
    interface EmployeeRPCResponse {
      id: number;
      name: string;
      role: string;
      department_name: string;
    }

    const { data: empData, error: empError } = await supabase
      .rpc('verify_employee_pin', { p_pin: pin })
      .maybeSingle<EmployeeRPCResponse>();

    let userData: UserType | null = null;
    let authEmail = '';
    
    if (empData && !empError) {
      userData = {
        id: empData.id,
        name: empData.name,
        role: empData.role,
        department: empData.department_name,
        type: 'employee',
      };
      // Use ID in email to be immutable and secure (pin changes won't change email)
      authEmail = `emp_${empData.id}@kmn.local`;
    }

    if (!userData || !authEmail) {
      throw new Error('Nieprawidłowy PIN');
    }

    // 3. Authenticate (Skip Supabase Auth for Employees - Local State Only)
    // We trust verify_employee_pin result.
    
    try {
      // 4. Success - Update State
      setUser(userData);
      // Determine session duration: admin -> 1 hour, kiosk/others -> 1 minute
      const isAdminPath = redirectPath.includes('/admin');
      const sessionMs = isAdminPath ? 60 * 60 * 1000 : 60 * 1000;
      const expiresAt = Date.now() + sessionMs;
      localStorage.setItem('kmn_auth', JSON.stringify({ user: userData, expiresAt }));
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
      logoutTimer.current = window.setTimeout(() => {
        (async () => {
          await supabase.auth.signOut().catch(() => {});
          localStorage.removeItem('kmn_auth');
          setUser(null);
          try { router.push('/login'); } catch {}
        })();
      }, sessionMs);
      scheduleLogout(sessionMs);
      
      // 5. Log the login
      // Note: This might fail if RLS requires auth.uid(). 
      // If it fails, we catch it but don't block login (or maybe we should?).
      // For now, let's try to insert. If 'user_logs' is public-insertable or we don't care about RLS for logs, it's fine.
      try {
          await supabase.from('user_logs').insert({
            user_name: userData.name,
            user_type: userData.type,
            department_name: userData.department
          });
      } catch (logErr) {
          console.warn("Failed to log login:", logErr);
      }

      router.push(redirectPath);
      return userData;

    } catch (err) {
      console.error("Auth Error:", err);
      const message = err instanceof Error ? err.message : 'Nieznany błąd';
      throw new Error('Błąd autoryzacji: ' + message);
    }
  };

  const logout = async () => {
    teardownInactivityTracking();
    clearLogoutTimer();
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('kmn_auth');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
