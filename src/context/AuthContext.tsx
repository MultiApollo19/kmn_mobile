'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    kmnShowSessionWarning?: (seconds?: number) => void;
  }
}


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
  sessionWarningSeconds: number | null;
  loginWithPin: (pin: string, redirectPath?: string) => Promise<UserType | void>;
  extendSession: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTO_EXIT_TIMEZONE = 'Europe/Warsaw';
const AUTO_EXIT_HOUR = 16;
const SESSION_WARNING_LEAD_MS = 2 * 60 * 1000;

type TimeZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const getTimeZoneParts = (date: Date, timeZone: string): TimeZoneParts => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const getTimeZoneOffsetMs = (timeZone: string, date: Date) => {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
};

const zonedTimeToUtcIso = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - offset).toISOString();
};

const shouldAutoExit = (parts: TimeZoneParts) => {
  if (parts.hour > AUTO_EXIT_HOUR) return true;
  if (parts.hour < AUTO_EXIT_HOUR) return false;
  return parts.minute >= 0;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarningSeconds, setSessionWarningSeconds] = useState<number | null>(null);
  const router = useRouter();
  const logoutTimer = useRef<number | null>(null);
  const warningTimer = useRef<number | null>(null);
  const warningInterval = useRef<number | null>(null);
  const activityHandlerRef = useRef<(() => void) | null>(null);

  const clearLogoutTimer = () => {
    if (logoutTimer.current) {
      window.clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
  };

  const clearWarningTimers = () => {
    if (warningTimer.current) {
      window.clearTimeout(warningTimer.current);
      warningTimer.current = null;
    }
    if (warningInterval.current) {
      window.clearInterval(warningInterval.current);
      warningInterval.current = null;
    }
    setSessionWarningSeconds(null);
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

  const startWarningCountdown = (expiresAt: number) => {
    const updateCountdown = () => {
      const remainingMs = expiresAt - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setSessionWarningSeconds(remainingSeconds);
      if (remainingSeconds <= 0 && warningInterval.current) {
        window.clearInterval(warningInterval.current);
        warningInterval.current = null;
      }
    };

    updateCountdown();
    if (warningInterval.current) window.clearInterval(warningInterval.current);
    warningInterval.current = window.setInterval(updateCountdown, 1000);
  };

  const scheduleWarning = (expiresAt: number, enabled: boolean) => {
    clearWarningTimers();
    if (!enabled) return;
    const warnAt = expiresAt - SESSION_WARNING_LEAD_MS;
    const delay = warnAt - Date.now();
    if (delay <= 0) {
      startWarningCountdown(expiresAt);
      return;
    }
    warningTimer.current = window.setTimeout(() => {
      startWarningCountdown(expiresAt);
    }, delay);
  };

  const updateSessionTimers = (expiresAt: number, enableWarning: boolean) => {
    const ms = Math.max(0, expiresAt - Date.now());
    scheduleLogout(ms);
    scheduleWarning(expiresAt, enableWarning);
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
          const isAdminUser = parsed.user.role === 'admin' || parsed.user.role === 'department_admin';
          updateSessionTimers(nextExpiresAt, isAdminUser);
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

  const getStoredAuth = () => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('kmn_auth');
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as { user: UserType; expiresAt?: number } | UserType;
      if (parsed && typeof parsed === 'object' && 'user' in parsed) {
        const payload = parsed as { user: UserType; expiresAt?: number };
        if (payload.expiresAt && typeof payload.expiresAt === 'number') {
          if (Date.now() > payload.expiresAt) {
            localStorage.removeItem('kmn_auth');
            return null;
          }
        }
        return payload;
      }
      return { user: parsed as UserType };
    } catch {
      return null;
    }
  };

  // Restore session from localStorage or Supabase session
  useEffect(() => {
    const initializeAuth = async () => {
      const storedAuth = getStoredAuth();
      if (storedAuth?.user) {
        setUser(storedAuth.user);
        if (storedAuth.expiresAt && typeof storedAuth.expiresAt === 'number') {
          const isAdminUser = storedAuth.user.role === 'admin' || storedAuth.user.role === 'department_admin';
          updateSessionTimers(storedAuth.expiresAt, isAdminUser);
        }
      }

      await supabase.auth.getSession();
      setLoading(false);
    };

    initializeAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const storedAuth = getStoredAuth();
        if (!storedAuth?.user) {
          setUser(null);
          localStorage.removeItem('kmn_auth');
          clearWarningTimers();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) {
      teardownInactivityTracking();
      clearLogoutTimer();
      clearWarningTimers();
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.kmnShowSessionWarning = (seconds?: number) => {
      const fallbackSeconds = 120;
      const safeSeconds = Math.max(1, Math.floor(seconds ?? fallbackSeconds));
      clearWarningTimers();
      startWarningCountdown(Date.now() + safeSeconds * 1000);
    };

    return () => {
      delete window.kmnShowSessionWarning;
    };
  }, []);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const runAutoExit = async () => {
      const nowParts = getTimeZoneParts(new Date(), AUTO_EXIT_TIMEZONE);
      if (!shouldAutoExit(nowParts)) return;

      const baseUtc = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day));
      const nextUtc = new Date(baseUtc);
      nextUtc.setUTCDate(nextUtc.getUTCDate() + 1);

      const startIso = zonedTimeToUtcIso(
        AUTO_EXIT_TIMEZONE,
        nowParts.year,
        nowParts.month,
        nowParts.day,
        0,
        0,
        0
      );
      const endIso = zonedTimeToUtcIso(
        AUTO_EXIT_TIMEZONE,
        nextUtc.getUTCFullYear(),
        nextUtc.getUTCMonth() + 1,
        nextUtc.getUTCDate(),
        0,
        0,
        0
      );
      const cutoffIso = zonedTimeToUtcIso(
        AUTO_EXIT_TIMEZONE,
        nowParts.year,
        nowParts.month,
        nowParts.day,
        AUTO_EXIT_HOUR,
        0,
        0
      );

      try {
        const { error } = await supabase
          .from('visits')
          .update({ exit_time: cutoffIso, is_system_exit: true })
          .is('exit_time', null)
          .gte('entry_time', startIso)
          .lt('entry_time', endIso);

        if (error) {
          console.error('Auto-exit update failed:', error);
        }
      } catch (err) {
        console.error('Auto-exit update error:', err);
      }
    };

    void runAutoExit();
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
      const isAdminUser = userData.role === 'admin' || userData.role === 'department_admin';
      updateSessionTimers(expiresAt, isAdminUser);
      
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
    clearWarningTimers();
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('kmn_auth');
    setUser(null);
    router.push('/login');
  };

  const extendSession = () => {
    const currentUser = user ?? getStoredAuth()?.user;
    if (!currentUser) return;
    const isAdminUser = currentUser.role === 'admin' || currentUser.role === 'department_admin';
    const sessionMs = isAdminUser ? 60 * 60 * 1000 : 60 * 1000;
    const expiresAt = Date.now() + sessionMs;
    localStorage.setItem('kmn_auth', JSON.stringify({ user: currentUser, expiresAt }));
    updateSessionTimers(expiresAt, isAdminUser);
    setUser(currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, sessionWarningSeconds, loginWithPin, extendSession, logout }}>
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
