import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ensure we have the required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Supabase credentials not found. Please connect to Supabase using the button in the top right.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseKey || 'placeholder-key'
)

// Types for our tables
export type ProblemCategory = {
  id: number
  name: string
  description: string | null
  created_at: string
}

export type Problem = {
  id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  category_id: number
  url: string | null
  description: string | null
  tags: string[]
  created_at: string
}

export type Attempt = {
  id: string
  problem_id: number
  user_id: string
  completed: boolean
  last_attempted: string | null
  next_review: string | null
  level: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProblemWithAttempt = Problem & {
  attempt?: Attempt
}

// Habit types
export type HabitType = {
  id: string
  created_at: string
  name: string
  description: string | null
  scheduling_rule: 'pull_back_15min' | 'fixed_time' | 'flexible'
}

export type Habit = {
  id: string
  created_at: string
  name: string
  benefits: string[]
  consequences: string[]
  conversation_id: string | null
  user_id: string | null
  duration: number
  is_visible: boolean
  habit_type_id: string | null
  default_start_time: string | null
  current_start_time: string | null
}

export type HabitDailyLog = {
  id: string
  created_at: string
  habit_id: string
  user_id: string
  log_date: string
  scheduled_start_time: string | null
  actual_start_time: string | null
  actual_end_time: string | null
  is_completed: boolean
  notes: string | null
}

export type HabitWithType = Habit & {
  habits_types?: HabitType
  habits_daily_logs?: HabitDailyLog[]
}
