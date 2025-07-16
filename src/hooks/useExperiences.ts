import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Experience } from '../types';

export function useExperiences(personId?: string) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (personId) {
      fetchExperiences();
    }
  }, [personId]);

  const fetchExperiences = async () => {
    if (!personId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('experiences')
        .select('*')
        .eq('person_id', personId)
        .eq('user_id', user.id)
        .order('experience_date', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setExperiences(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addExperience = async (experience: Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('experiences')
        .insert([{ ...experience, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setExperiences(prev => [data, ...prev.filter(e => e.id !== data.id)].sort((a, b) => 
        new Date(b.experience_date).getTime() - new Date(a.experience_date).getTime()
      ));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add experience');
    }
  };

  const updateExperience = async (id: string, updates: Partial<Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('experiences')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setExperiences(prev => prev.map(e => e.id === id ? data : e).sort((a, b) => 
        new Date(b.experience_date).getTime() - new Date(a.experience_date).getTime()
      ));
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update experience');
    }
  };

  const deleteExperience = async (id: string) => {
    try {
      const { error } = await supabase
        .from('experiences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExperiences(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete experience');
    }
  };

  return {
    experiences,
    loading,
    error,
    addExperience,
    updateExperience,
    deleteExperience,
    refetch: fetchExperiences
  };
}