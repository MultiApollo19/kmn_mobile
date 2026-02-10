'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { createActorClient } from '@/src/lib/supabaseActor';
import { useAuth } from '@/src/hooks/useAuth';
import { Plus, Trash2, Edit2, Save, X, Loader2, Building2 } from 'lucide-react';
import Modal from '@/src/components/Modal';

type Department = {
  id: number;
  name: string;
};

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({ name: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('Error fetching departments:', error);
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  };

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
    const { data: employees, error: checkError } = await supabase
      .from('employees')
      .select('name')
      .eq('department_id', id);

    if (checkError) {
      alert('Błąd podczas sprawdzania powiązań: ' + checkError.message);
      return;
    }

    if (employees && employees.length > 0) {
      const names = employees.map(e => e.name).slice(0, 5).join(', ');
      const more = employees.length > 5 ? ` i ${employees.length - 5} innych` : '';
      alert(`Nie można usunąć działu. Przypisani pracownicy: ${names}${more}. Musisz ich najpierw przenieść lub usunąć.`);
      return;
    }

    if (!confirm('Czy na pewno chcesz usunąć ten dział?')) return;

    const actorClient = createActorClient(user);
    const { error } = await actorClient
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Błąd podczas usuwania (Code: ${error.code}): ${error.message} \n\nDetails: ${error.details}`);
    } else {
      fetchDepartments();
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
        const actorClient = createActorClient(user);
        const { error } = await actorClient
          .from('departments')
          .insert([{ name: formData.name }]);
        
        if (error) throw error;
      } else if (isEditing) {
        const actorClient = createActorClient(user);
        const { error } = await actorClient
          .from('departments')
          .update({ name: formData.name })
          .eq('id', isEditing);
        
        if (error) throw error;
      }

      handleCancel();
      fetchDepartments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wystąpił błąd';
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Działy</h1>
          <p className="text-muted-foreground">Zarządzanie strukturą organizacyjną firmy</p>
        </div>
        
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
        ) : departments.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Brak zdefiniowanych działów. Dodaj pierwszy dział.
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
                {departments.map((dept) => (
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