import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ensure we have the required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not found. Please connect to Supabase using the button in the top right.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseKey || 'placeholder-key'
);

// Types for our tables
export type ProblemCategory = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type Problem = {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category_id: number;
  url: string | null;
  description: string | null;
  completed: boolean;
  last_attempted: string | null;
  next_review: string | null;
  level: number;
  notes: string | null;
  tags: string[];
  created_at: string;
};