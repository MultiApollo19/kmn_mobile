'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/lib/supabase';
import { createActorClient } from '@/src/lib/supabaseActor';
import { Loader2, Plus, Trash2, Edit2, Check, X, AlertCircle, Shield, Settings as SettingsIcon, Flag } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';

interface VisitPurpose {
  id: number;
  name: string;
}

interface Badge {
  id: number;
  badge_number: string;
  is_active: boolean;
  created_at: string;
}

const BADGE_COLLATOR = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });

const normalizeBadgeNumber = (value: string) => value.trim();

const compareBadgeNumber = (left: string, right: string) =>
  BADGE_COLLATOR.compare(normalizeBadgeNumber(left), normalizeBadgeNumber(right));

export default function AdminSettingsClient() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'purposes' | 'identifiers'>('general');
  
  // Visit Purposes State
  const [purposes, setPurposes] = useState<VisitPurpose[]>([]);
  const [newPurpose, setNewPurpose] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  
  // Badges State
  const [badges, setBadges] = useState<Badge[]>([]);
  const [newBadgeNumber, setNewBadgeNumber] = useState('');
  const [addingBadge, setAddingBadge] = useState(false);
  
  // Error State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [purposesRes, badgesRes] = await Promise.all([
        supabase.from('visit_purposes').select('*').order('name'),
        supabase.from('badges').select('*').order('badge_number')
      ]);

      if (purposesRes.error) throw purposesRes.error;
      if (badgesRes.error) throw badgesRes.error;

      setPurposes(purposesRes.data || []);
      setBadges(badgesRes.data || []);
    } catch (err) {
      console.error('Error loading settings data:', err);
      setError('Nie udało się załadować danych ustawień');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Add Purpose
  const handleAddPurpose = async () => {
    if (!newPurpose.trim()) return;
    
    try {
      const actorClient = createActorClient(user);
      const { data, error } = await actorClient
        .from('visit_purposes')
        .insert([{ name: newPurpose.trim() }])
        .select()
        .single();
      
      if (error) throw error;
      
      setPurposes([...purposes, data]);
      setNewPurpose('');
      setSuccess('Cel wizyty dodany pomyślnie');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error adding purpose:', err);
      setError('Nie udało się dodać celu wizyty');
    }
  };

  // Update Purpose
  const handleUpdatePurpose = async (id: number) => {
    if (!editingName.trim()) return;
    
    setSavingId(id);
    try {
      const actorClient = createActorClient(user);
      const { error } = await actorClient
        .from('visit_purposes')
        .update({ name: editingName.trim() })
        .eq('id', id);
      
      if (error) throw error;
      
      setPurposes(purposes.map(p => p.id === id ? { ...p, name: editingName.trim() } : p));
      setEditingId(null);
      setEditingName('');
      setSuccess('Cel wizyty zaktualizowany pomyślnie');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating purpose:', err);
      setError('Nie udało się zaktualizować celu wizyty');
    } finally {
      setSavingId(null);
    }
  };

  // Delete Purpose
  const handleDeletePurpose = async (id: number) => {
    if (!confirm('Na pewno chcesz usunąć ten cel wizyty?')) return;
    
    try {
      const actorClient = createActorClient(user);
      const { error } = await actorClient
        .from('visit_purposes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setPurposes(purposes.filter(p => p.id !== id));
      setSuccess('Cel wizyty usunięty pomyślnie');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting purpose:', err);
      setError('Nie udało się usunąć celu wizyty');
    }
  };

  // Add Badge
  const handleAddBadge = async () => {
    if (!newBadgeNumber.trim()) return;
    
    setAddingBadge(true);
    try {
      const actorClient = createActorClient(user);
      const { data, error } = await actorClient
        .from('badges')
        .insert([{ badge_number: newBadgeNumber.trim() }])
        .select()
        .single();
      
      if (error) throw error;
      
      setBadges([...badges, data]);
      setNewBadgeNumber('');
      setSuccess('Identyfikator dodany pomyślnie');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error adding badge:', err);
      setError('Nie udało się dodać identyfikatora');
    } finally {
      setAddingBadge(false);
    }
  };

  // Toggle Badge
  const handleToggleBadge = async (id: number, currentStatus: boolean) => {
    try {
      const actorClient = createActorClient(user);
      const { error } = await actorClient
        .from('badges')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      setBadges(badges.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
      setSuccess(`Identyfikator ${!currentStatus ? 'aktywowany' : 'deaktywowany'} pomyślnie`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error toggling badge:', err);
      setError('Nie udało się zmienić statusu identyfikatora');
    }
  };

  // Delete Badge
  const handleDeleteBadge = async (id: number) => {
    if (!confirm('Na pewno chcesz usunąć ten identyfikator?')) return;
    
    try {
      const actorClient = createActorClient(user);
      const { error } = await actorClient
        .from('badges')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setBadges(badges.filter(b => b.id !== id));
      setSuccess('Identyfikator usunięty pomyślnie');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting badge:', err);
      setError('Nie udało się usunąć identyfikatora');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const sortedBadges = [...badges].sort((a, b) =>
    compareBadgeNumber(a.badge_number, b.badge_number)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ustawienia systemu</h1>
          <p className="text-muted-foreground mt-1">Zarządzaj konfiguracją i ustawieniami aplikacji</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4 flex items-gap gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Błąd</p>
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-700 rounded-lg p-4 flex items-center gap-3">
          <Check size={20} className="shrink-0" />
          <p className="font-medium">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            'px-4 py-3 font-medium border-b-2 transition-colors',
            activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <SettingsIcon size={18} />
            Ogólne
          </div>
        </button>
        <button
          onClick={() => setActiveTab('purposes')}
          className={cn(
            'px-4 py-3 font-medium border-b-2 transition-colors',
            activeTab === 'purposes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <Flag size={18} />
            Cele wizyt
          </div>
        </button>
        <button
          onClick={() => setActiveTab('identifiers')}
          className={cn(
            'px-4 py-3 font-medium border-b-2 transition-colors',
            activeTab === 'identifiers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <Shield size={18} />
            Identyfikatory
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4">Informacje użytkownika</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Nazwa</label>
                  <div className="p-3 bg-muted rounded-lg">{user?.name || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Rola</label>
                  <div className="p-3 bg-muted rounded-lg">{user?.role === 'admin' ? 'Administrator' : 'Kierownik'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Dział</label>
                  <div className="p-3 bg-muted rounded-lg">{user?.department || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visit Purposes Tab */}
        {activeTab === 'purposes' && (
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4">Cele wizyt</h2>
              <p className="text-muted-foreground mb-6 text-sm">Zarządzaj dostępnymi celami dla wizyt interesantów</p>
              
              {/* Add New Purpose */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddPurpose()}
                  placeholder="Nowy cel wizyty..."
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddPurpose}
                  disabled={!newPurpose.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={18} />
                  Dodaj
                </button>
              </div>

              {/* Purposes List */}
              {purposes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Brak celów wizyt. Dodaj pierwszy!</p>
              ) : (
                <div className="space-y-2">
                  {purposes.map((purpose) => (
                    <div key={purpose.id} className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group">
                      {editingId === purpose.id ? (
                        <>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdatePurpose(purpose.id)}
                            disabled={savingId === purpose.id}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors disabled:opacity-50"
                          >
                            {savingId === purpose.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 text-muted-foreground hover:bg-muted rounded transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium text-foreground">{purpose.name}</span>
                          <button
                            onClick={() => {
                              setEditingId(purpose.id);
                              setEditingName(purpose.name);
                            }}
                            className="p-2 text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 rounded transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeletePurpose(purpose.id)}
                            className="p-2 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 rounded transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>          </div>
        )}

        {/* Identifiers Tab */}
        {activeTab === 'identifiers' && (
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-xl font-bold mb-4">Zarządzanie identyfikatorami</h2>
              <p className="text-muted-foreground mb-6 text-sm">Dodawaj i usuwaj identyfikatory dla interesantów</p>
              
              {/* Add New Badge */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newBadgeNumber}
                  onChange={(e) => setNewBadgeNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddBadge()}
                  placeholder="Nowy identyfikator..."
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddBadge}
                  disabled={!newBadgeNumber.trim() || addingBadge}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addingBadge ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  Dodaj
                </button>
              </div>

              {/* Badges List */}
              {badges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Brak identyfikatorów. Dodaj pierwszy!</p>
              ) : (
                <div className="space-y-2">
                  {sortedBadges.map((badge) => (
                    <div key={badge.id} className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{badge.badge_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {badge.is_active ? 'Aktywny' : 'Nieaktywny'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleBadge(badge.id, badge.is_active)}
                        className={cn(
                          'px-3 py-1 rounded text-sm font-medium transition-colors',
                          badge.is_active
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-muted text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {badge.is_active ? 'Deaktywuj' : 'Aktywuj'}
                      </button>
                      <button
                        onClick={() => handleDeleteBadge(badge.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 rounded transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
