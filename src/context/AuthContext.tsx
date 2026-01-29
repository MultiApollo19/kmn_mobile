'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useRouter } from 'next/navigation';

export type UserType = {
  id: string | number;
  name: string;
  role: string;
  department?: string;
  type: 'employee' | 'department';
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

  useEffect(() => {
    const stored = localStorage.getItem('kmn_auth');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('kmn_auth');
      }
    }
    setLoading(false);
  }, []);

  const loginWithPin = async (pin: string, redirectPath: string = '/') => {
    // 1. Check Employees
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*, departments(name)')
      .eq('pin', pin)
      .single();

    if (empData && !empError) {
      const userData: UserType = {
        id: empData.id,
        name: empData.name,
        role: empData.role,
        department: empData.departments?.name,
        type: 'employee',
      };
      setUser(userData);
      localStorage.setItem('kmn_auth', JSON.stringify(userData));
      
      await supabase.from('user_logs').insert({
        user_name: userData.name,
        user_type: userData.type,
        department_name: userData.department
      });

      router.push(redirectPath);
      return userData;
    }

    // 2. Check Departments
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('general_pin', pin)
      .single();

    if (deptData && !deptError) {
      const userData: UserType = {
        id: deptData.id,
        name: deptData.name,
        role: 'department_admin',
        department: deptData.name,
        type: 'department',
      };
      setUser(userData);
      localStorage.setItem('kmn_auth', JSON.stringify(userData));
      
      await supabase.from('user_logs').insert({
        user_name: userData.name,
        user_type: userData.type,
        department_name: userData.department
      });

      router.push(redirectPath);
      return userData;
    }

    throw new Error('Nieprawidłowy PIN');
  };

  const logout = () => {
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
