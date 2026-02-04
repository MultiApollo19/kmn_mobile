'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
            setUser(JSON.parse(stored));
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
  }, []);

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
      localStorage.setItem('kmn_auth', JSON.stringify(userData));
      
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
    await supabase.auth.signOut();
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
