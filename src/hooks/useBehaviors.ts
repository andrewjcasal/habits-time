import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Behavior } from '../types';

export function useBehaviors() {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBehaviors();
  }, []);

  const fetchBehaviors = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('behaviors')
        .select('*')
        .eq('user_id', user.id)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setBehaviors(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addBehavior = async (behavior: Omit<Behavior, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('behaviors')
        .insert([{ ...behavior, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setBehaviors(prev => [...prev, data]);
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add behavior');
    }
  };

  const updateBehavior = async (id: string, updates: Partial<Omit<Behavior, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('behaviors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setBehaviors(prev => prev.map(b => b.id === id ? data : b));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update behavior');
    }
  };

  const deleteBehavior = async (id: string) => {
    try {
      const { error } = await supabase
        .from('behaviors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBehaviors(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete behavior');
    }
  };

  return {
    behaviors,
    loading,
    error,
    addBehavior,
    updateBehavior,
    deleteBehavior,
    refetch: fetchBehaviors
  };
}