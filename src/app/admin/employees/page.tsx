'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildActorHeaders } from '@/src/lib/supabaseActor';
import { useAuth } from '@/src/hooks/useAuth';
import { hashPinClient } from '@/src/lib/pinHash.client';
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
  has_pin: boolean;
  department_id: number | null;
  role: 'user' | 'admin' | 'department_admin';
  departments: Department | null;
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = useMemo(() => (searchParams.get('search') || '').trim().toLowerCase(), [searchParams]);
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
  const [pinError, setPinError] = useState<string | null>(null);
  const [isCheckingPin, setIsCheckingPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'employees.list' }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { employees: Employee[]; departments: Department[] };
      setEmployees(payload.employees || []);
      setDepartments(payload.departments || []);
    } catch (error) {
      console.error('Error fetching employees/departments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    const checkPin = async () => {
      const pin = formData.pin;
      if (pin.length === 4) {
        setIsCheckingPin(true);
        setPinError(null);
        try {
          const pinHash = await hashPinClient(pin);
          const response = await fetch('/api/employees/check-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinHash, excludeEmployeeId: isEditing }),
          });
          const data = await response.json();
          if (data.isTaken) {
            setPinError('Ten PIN jest już przypisany do innego pracownika.');
          }
        } catch (error) {
          console.error('Błąd podczas sprawdzania PIN:', error);
        } finally {
          setIsCheckingPin(false);
        }
      } else {
        setPinError(null);
        setIsCheckingPin(false);
      }
    };

    const timer = setTimeout(checkPin, 500);
    return () => clearTimeout(timer);
  }, [formData.pin, isEditing]);

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
    setPinError(null);
    setIsCheckingPin(false);
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setFormData({ name: '', pin: '', department_id: '', role: 'user' });
    setError(null);
    setPinError(null);
    setIsCheckingPin(false);
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tego pracownika?')) return;

    try {
      const deleteRes = await fetch('/api/db/mutate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildActorHeaders(user),
        },
        body: JSON.stringify({
          table: 'employees',
          action: 'delete',
          filters: [{ column: 'id', op: 'eq', value: id }],
        })
      });
      if (!deleteRes.ok) throw new Error(`HTTP ${deleteRes.status}`);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wystąpił błąd';
      alert('Błąd podczas usuwania: ' + message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name) {
      setError('Imię i nazwisko są wymagane');
      return;
    }
    
    // Validation: PIN is required for new users, optional for editing
    if (isAdding && !formData.pin) {
        setError('PIN jest wymagany dla nowego pracownika');
        return;
    }

    const normalizedPin = formData.pin.trim();
    if (normalizedPin && !/^\d{4}$/.test(normalizedPin)) {
        setError('PIN musi mieć dokładnie 4 cyfry');
        return;
    }

    if (pinError || isCheckingPin) {
        setError('Popraw błędy w formularzu przed zapisem');
        return;
    }

    setIsSaving(true);

    try {
      const pinHash = normalizedPin ? await hashPinClient(normalizedPin) : null;

      const response = await fetch('/api/employees/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildActorHeaders(user),
        },
        body: JSON.stringify({
          id: isEditing || null,
          name: formData.name,
          pin: normalizedPin || null,
          pinHash,
          role: formData.role,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
        }),
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const errorPayload = await response.json() as { error?: string };
          if (errorPayload?.error) message = errorPayload.error;
        } catch {}
        throw new Error(message);
      }

      handleCancel();
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    return employees.filter((emp) => emp.name.toLowerCase().includes(searchQuery));
  }, [employees, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        <button 
          onClick={() => { setIsAdding(true); setFormData({ name: '', pin: '', department_id: '', role: 'user' }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors font-medium shadow-sm cursor-pointer"
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
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {searchQuery ? `Brak wyników dla "${searchQuery}".` : 'Brak pracowników. Dodaj pierwszego pracownika.'}
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
                {filteredEmployees.map((emp) => (
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(emp)}
                          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                          title="Edytuj"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id)}
                          className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
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
        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Imię i nazwisko</label>
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
              {isAdding ? 'PIN osobisty' : 'Zmień PIN (opcjonalnie)'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                inputMode="numeric"
                maxLength={4}
                className={cn(
                  "w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors",
                  pinError 
                    ? "border-destructive focus:ring-destructive/20 focus:border-destructive" 
                    : formData.pin.length === 4 && !isCheckingPin
                      ? "border-green-500 focus:ring-green-500/20 focus:border-green-500 bg-green-50/50"
                      : "border-input focus:ring-primary/20 focus:border-primary"
                )}
                placeholder={isAdding ? "np. 1234" : "Wpisz nowy PIN, aby zmienić"}
              />
              {isCheckingPin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                </div>
              )}
            </div>
             <p className={cn("text-xs mt-1 transition-colors", pinError ? "text-destructive font-medium" : formData.pin.length === 4 && !isCheckingPin ? "text-green-600 font-medium" : "text-muted-foreground")}>
                 {pinError ? pinError : (formData.pin.length === 4 && !isCheckingPin ? "PIN jest wolny" : (isAdding ? "Wymagane 4 cyfry." : "Pozostaw puste, aby zachować obecny PIN."))}
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
                  <option value="admin">Administrator systemu</option>
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
              disabled={isSaving}
              className="flex items-center gap-2 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-lg transition-colors font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={16} />
              Anuluj
            </button>
            <button 
              type="submit" 
              disabled={isSaving || isCheckingPin}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
