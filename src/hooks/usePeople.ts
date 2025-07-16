import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Person } from '../types';

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('people')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setPeople(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addPerson = async (person: Omit<Person, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('people')
        .insert([{ ...person, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setPeople(prev => [data, ...prev.filter(p => p.id !== data.id)].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add person');
    }
  };

  const updatePerson = async (id: string, updates: Partial<Omit<Person, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('people')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setPeople(prev => prev.map(p => p.id === id ? data : p).sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update person');
    }
  };

  const deletePerson = async (id: string) => {
    try {
      const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPeople(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete person');
    }
  };

  return {
    people,
    loading,
    error,
    addPerson,
    updatePerson,
    deletePerson,
    refetch: fetchPeople
  };
}