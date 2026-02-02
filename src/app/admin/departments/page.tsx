'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Plus, Trash2, Edit2, Save, X, Loader2, Building2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import Modal from '@/src/components/Modal';

type Department = {
  id: number;
  name: string;
  general_pin: string;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({ name: '', general_pin: '' });
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
    setFormData({ name: dept.name, general_pin: dept.general_pin });
    setIsAdding(false);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setFormData({ name: '', general_pin: '' });
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten dział? Może to wpłynąć na przypisanych pracowników.')) return;

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Błąd podczas usuwania: ' + error.message);
    } else {
      fetchDepartments();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.general_pin) {
      setError('Wszystkie pola są wymagane');
      return;
    }

    if (formData.general_pin.length < 4) {
        setError('PIN musi mieć co najmniej 4 znaki');
        return;
    }

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('departments')
          .insert([{ name: formData.name, general_pin: formData.general_pin }]);
        
        if (error) throw error;
      } else if (isEditing) {
        const { error } = await supabase
          .from('departments')
          .update({ name: formData.name, general_pin: formData.general_pin })
          .eq('id', isEditing);
        
        if (error) throw error;
      }

      handleCancel();
      fetchDepartments();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Działy</h1>
          <p className="text-muted-foreground">Zarządzanie strukturą organizacyjną firmy</p>
        </div>
        
        <button 
          onClick={() => { setIsAdding(true); setFormData({ name: '', general_pin: '' }); }}
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
                  <th className="px-6 py-4 w-16">ID</th>
                  <th className="px-6 py-4">Nazwa</th>
                  <th className="px-6 py-4">PIN Ogólny</th>
                  <th className="px-6 py-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 text-muted-foreground font-mono">{dept.id}</td>
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {dept.name}
                    </td>
                    <td className="px-6 py-4 font-mono">{dept.general_pin}</td>
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
          
          <div>
            <label className="block text-sm font-medium mb-1">PIN ogólny</label>
            <input
              type="text"
              value={formData.general_pin}
              onChange={(e) => setFormData({ ...formData, general_pin: e.target.value })}
              className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="np. 1234"
            />
            <p className="text-xs text-muted-foreground mt-1">Używany do autoryzacji operacji dla całego działu.</p>
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