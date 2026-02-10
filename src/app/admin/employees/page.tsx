'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { createActorClient } from '@/src/lib/supabaseActor';
import { useAuth } from '@/src/hooks/useAuth';
import { Plus, Trash2, Edit2, Save, X, Loader2, Building2, User, Shield, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import Modal from '@/src/components/Modal';

type Department = {
  id: number;
  name: string;
};

type Employee = {
  id: number;
  name: string;
  password: string | null;
  department_id: number | null;
  role: 'user' | 'admin' | 'department_admin';
  departments: Department | null;
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({ 
    name: '', 
    pin: '', 
    department_id: '', 
    role: 'user' 
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Employees with Departments
    const employeesQuery = supabase
      .from('employees')
      .select(`
        id,
        name,
        role,
        department_id,
        password,
        departments (
          id,
          name
        )
      `)
      .order('name', { ascending: true });

    // Fetch Departments for dropdown
    const departmentsQuery = supabase
      .from('departments')
      .select('id, name')
      .order('name', { ascending: true });

    const [empRes, deptRes] = await Promise.all([employeesQuery, departmentsQuery]);

    if (empRes.error) console.error('Error fetching employees:', empRes.error);
    if (deptRes.error) console.error('Error fetching departments:', deptRes.error);

    // Normalize departments field: Supabase may return an array for the joined relation
    type RawEmployee = {
      id: number;
      name: string;
      password: string | null;
      department_id: number | null;
      role: 'user' | 'admin' | 'department_admin';
      departments?: { id: number; name: string }[] | { id: number; name: string } | null;
    };

    const normalizedEmployees = (empRes.data || []).map((e: unknown) => {
      const rec = e as RawEmployee;
      return {
        id: rec.id,
        name: rec.name,
        password: rec.password,
        department_id: rec.department_id,
        role: rec.role,
        departments: Array.isArray(rec.departments) ? (rec.departments[0] || null) : (rec.departments || null),
      };
    });

    setEmployees(normalizedEmployees as Employee[]);
    setDepartments(deptRes.data || []);
    setLoading(false);
  };

  const handleEdit = (emp: Employee) => {
    setIsEditing(emp.id);
    setFormData({ 
      name: emp.name, 
      pin: '', // Do not fill existing PIN (it's hashed)
      department_id: emp.department_id?.toString() || '', 
      role: emp.role 
    });
    setIsAdding(false);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setFormData({ name: '', pin: '', department_id: '', role: 'user' });
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tego pracownika?')) return;

    const actorClient = createActorClient(user);
    const { error } = await actorClient
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Błąd podczas usuwania: ' + error.message);
    } else {
      fetchData();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name) {
      setError('Nazwa jest wymagana');
      return;
    }
    
    // Validation: PIN is required for new users, optional for editing
    if (isAdding && !formData.pin) {
        setError('PIN jest wymagany dla nowego pracownika');
        return;
    }

    if (formData.pin && formData.pin.length < 4) {
        setError('PIN musi mieć co najmniej 4 znaki');
        return;
    }

    try {
      // Use API Route for safe upsert and Auth Sync
      const response = await fetch('/api/employees/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-employee-id': String(user.id) } : {}),
          ...(user?.name ? { 'x-employee-name': user.name } : {}),
          ...(user?.department ? { 'x-employee-department-name': user.department } : {})
        },
        body: JSON.stringify({
            id: isEditing || null,
            name: formData.name,
            pin: formData.pin || null,
            role: formData.role,
            department_id: formData.department_id ? parseInt(formData.department_id) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
          throw new Error(data.error || 'Wystąpił błąd podczas zapisu');
      }

      handleCancel();
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pracownicy</h1>
          <p className="text-muted-foreground">Zarządzanie personelem i uprawnieniami</p>
        </div>
        
        <button 
          onClick={() => { setIsAdding(true); setFormData({ name: '', pin: '', department_id: '', role: 'user' }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          Dodaj pracownika
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Brak pracowników. Dodaj pierwszego pracownika.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-6 py-4">Pracownik</th>
                  <th className="px-6 py-4">Dział</th>
                  <th className="px-6 py-4">Rola</th>
                  <th className="px-6 py-4">PIN</th>
                  <th className="px-6 py-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                {emp.name.charAt(0)}
                            </div>
                            <span className="font-medium text-foreground">{emp.name}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                            {emp.departments?.name || <span className="italic opacity-50">Brak</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            emp.role === 'admin' ? "bg-purple-50 text-purple-700 border-purple-100" :
                            emp.role === 'department_admin' ? "bg-blue-50 text-blue-700 border-blue-100" :
                            "bg-gray-50 text-gray-600 border-gray-100"
                        )}>
                            {emp.role === 'admin' && <Shield className="w-3 h-3" />}
                            {emp.role === 'department_admin' && <Users className="w-3 h-3" />}
                            {emp.role === 'user' && <User className="w-3 h-3" />}
                            {emp.role === 'admin' ? 'Administrator' : emp.role === 'department_admin' ? 'Kierownik' : 'Użytkownik'}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">
                        {emp.password ? '••••' : <span className="text-destructive text-xs">Brak PIN</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(emp)}
                          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                          title="Edytuj"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id)}
                          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                          title="Usuń"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isAdding || isEditing !== null}
        onClose={handleCancel}
        title={isAdding ? 'Dodaj nowego pracownika' : 'Edytuj pracownika'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Imię i Nazwisko</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="np. Jan Kowalski"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              {isAdding ? 'PIN Osobisty' : 'Zmień PIN (opcjonalnie)'}
            </label>
            <input
              type="text"
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
              className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder={isAdding ? "np. 1234" : "Wpisz nowy PIN aby zmienić"}
            />
             <p className="text-xs text-muted-foreground mt-1">
                 {isAdding ? "Wymagane 4 cyfry." : "Pozostaw puste, aby zachować obecny PIN."}
             </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dział</label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">-- Wybierz dział --</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
              <label className="block text-sm font-medium mb-1">Rola</label>
              <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                  <option value="user">Użytkownik</option>
                  <option value="admin">Administrator Systemu</option>
              </select>
          </div>

          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 justify-end">
            <button 
              type="button" 
              onClick={handleCancel}
              className="flex items-center gap-2 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              <X size={16} />
              Anuluj
            </button>
            <button 
              type="submit" 
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            >
              <Save size={16} />
              Zapisz
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
