'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildActorHeaders } from '@/src/lib/supabaseActor';
import { useAuth } from '@/src/hooks/useAuth';
import { Plus, Trash2, Edit2, Save, X, Loader2, Building2 } from 'lucide-react';
import Modal from '@/src/components/Modal';

type Department = {
  id: number;
  name: string;
};

export default function DepartmentsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = useMemo(() => (searchParams.get('search') || '').trim().toLowerCase(), [searchParams]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({ name: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'departments.list' }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { departments: Department[] };
      setDepartments(payload.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDepartments();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchDepartments]);

  const handleEdit = (dept: Department) => {
    setIsEditing(dept.id);
    setFormData({ name: dept.name });
    setIsAdding(false);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setFormData({ name: '' });
    setError(null);
  };

  const handleDelete = async (id: number) => {
    // Check for assigned employees first
    const checkResponse = await fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'departments.employees', params: { departmentId: id } }),
    });
    if (!checkResponse.ok) {
      alert('B��d podczas sprawdzania powi�za�: HTTP ' + checkResponse.status);
      return;
    }
    const checkPayload = await checkResponse.json() as { employees: Array<{ name: string }> };
    const employees = checkPayload.employees || [];

    if (employees && employees.length > 0) {
      const names = employees.map(e => e.name).slice(0, 5).join(', ');
      const more = employees.length > 5 ? ` i ${employees.length - 5} innych` : '';
      alert(`Nie można usunąć działu. Przypisani pracownicy: ${names}${more}. Musisz ich najpierw przenieść lub usunąć.`);
      return;
    }

    if (!confirm('Czy na pewno chcesz usunąć ten dział?')) return;

    try {
      const response = await fetch('/api/db/mutate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildActorHeaders(user),
        },
        body: JSON.stringify({
          table: 'departments',
          action: 'delete',
          filters: [{ column: 'id', op: 'eq', value: id }],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fetchDepartments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wystąpił błąd';
      alert('Błąd podczas usuwania: ' + message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name) {
      setError('Nazwa działu jest wymagana');
      return;
    }

    try {
      if (isAdding) {
        const response = await fetch('/api/db/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildActorHeaders(user),
          },
          body: JSON.stringify({
            table: 'departments',
            action: 'insert',
            values: [{ name: formData.name }],
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } else if (isEditing) {
        const response = await fetch('/api/db/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildActorHeaders(user),
          },
          body: JSON.stringify({
            table: 'departments',
            action: 'update',
            values: { name: formData.name },
            filters: [{ column: 'id', op: 'eq', value: isEditing }],
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }

      handleCancel();
      fetchDepartments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wystąpił błąd';
      setError(message);
    }
  };

  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departments;
    return departments.filter((dept) => dept.name.toLowerCase().includes(searchQuery));
  }, [departments, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        <button 
          onClick={() => { setIsAdding(true); setFormData({ name: '' }); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          Dodaj dział
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {searchQuery ? `Brak wyników dla "${searchQuery}".` : 'Brak zdefiniowanych działów. Dodaj pierwszy dział.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-6 py-4">Nazwa</th>
                  <th className="px-6 py-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {dept.name}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(dept)}
                          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                          title="Edytuj"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(dept.id)}
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
        title={isAdding ? 'Dodaj nowy dział' : 'Edytuj dział'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nazwa działu</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="np. Produkcja"
            />
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