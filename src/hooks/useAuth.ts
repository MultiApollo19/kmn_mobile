import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useRouter } from 'next/navigation';

export type UserType = {
  id: string | number;
  name: string;
  role: string;
  department?: string;
  type: 'employee' | 'department';
};

export function useAuth() {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('kmn_auth');
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('kmn_auth');
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithPin = async (pin: string) => {
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
      
      // Log login
      await supabase.from('user_logs').insert({
        user_name: userData.name,
        user_type: userData.type,
        department_name: userData.department
      });

      router.push('/');
      return;
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
        name: deptData.name, // Department name acts as user name here
        role: 'department_admin',
        department: deptData.name,
        type: 'department',
      };
      setUser(userData);
      localStorage.setItem('kmn_auth', JSON.stringify(userData));
      
      // Log login
      await supabase.from('user_logs').insert({
        user_name: userData.name,
        user_type: userData.type,
        department_name: userData.department
      });

      router.push('/');
      return;
    }

    throw new Error('Nieprawidłowy PIN');
  };

  const logout = () => {
    localStorage.removeItem('kmn_auth');
    setUser(null);
    router.push('/login');
  };

  return {
    user,
    loading,
    loginWithPin,
    logout,
  };
}