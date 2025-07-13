import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { DailyReflection } from '../types';

export function useReflections() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReflection = async (date: string = new Date().toISOString().split('T')[0]): Promise<DailyReflection | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error: functionError } = await supabase.functions.invoke('generate-reflection', {
        body: { userId: user.id, date }
      });

      if (functionError) {
        throw functionError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        id: '', // Will be set by database
        user_id: user.id,
        reflection_date: date,
        content: data.reflection,
        reddit_links: data.reddit_links || [],
        generated_at: data.generated_at
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate reflection';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getTodaysReflection = async (): Promise<DailyReflection | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_reflections')
        .select('*')
        .eq('user_id', user.id)
        .eq('reflection_date', today)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      if (!data) return null;

      // Parse reddit_links if it's a JSON string
      let redditLinks = [];
      if (data.reddit_links) {
        try {
          redditLinks = typeof data.reddit_links === 'string' 
            ? JSON.parse(data.reddit_links) 
            : data.reddit_links;
        } catch (e) {
          console.error('Error parsing reddit_links:', e);
          redditLinks = [];
        }
      }

      return {
        ...data,
        reddit_links: redditLinks
      };
    } catch (err) {
      console.error('Error fetching today\'s reflection:', err);
      return null;
    }
  };

  return {
    generateReflection,
    getTodaysReflection,
    loading,
    error
  };
}