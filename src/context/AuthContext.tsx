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
    // We use an RPC to check the hash without exposing it to the client
    const { data: empData, error: empError } = await supabase
      .rpc('verify_employee_pin', { p_pin: pin })
      .maybeSingle();

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

    // 3. Authenticate with Supabase (Required for RLS)
    // Password remains based on PIN for this session (Supabase Auth hashes it)
    const authPassword = `kmn_mobile_${pin}`;

    try {
      // Try to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
            
        }

        // If sign in fails (likely User not found), try to Sign Up (Auto-provisioning)
        if (signInError.message.includes('Invalid login') || signInError.message.includes('not found')) {
            const { error: signUpError } = await supabase.auth.signUp({
                email: authEmail,
                password: authPassword,
                options: {
                    data: {
                        name: userData.name,
                        role: userData.role
                    }
                }
            });
            
            if (signUpError) {
                console.error("Auto-provisioning failed:", signUpError);
                throw new Error('Błąd autoryzacji systemowej (Sign Up)');
            }
            // Auto sign-in usually happens after sign up unless confirmation is required.
            // Assuming "Disable email confirmation" is ON in Supabase for this convenience.
        } else {
            throw signInError;
        }
      }

      // 4. Success - Update State
      setUser(userData);
      localStorage.setItem('kmn_auth', JSON.stringify(userData));
      
      // 5. Log the login
      await supabase.from('user_logs').insert({
        user_name: userData.name,
        user_type: userData.type,
        department_name: userData.department
      });

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
