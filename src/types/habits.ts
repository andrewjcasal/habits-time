// Habit-domain row types. Note: the canonical `Habit`, `HabitType`,
// `HabitDailyLog`, and `HabitWithType` types live in `src/lib/supabase.ts`
// (alongside the supabase client export) for historical reasons. Moving
// them here is a wider consumer-update refactor flagged for a later pass.

export interface HabitNote {
  id: string
  user_id: string
  title?: string | null
  content: string
  start_date: string
  start_time: string | null
  created_at: string
  updated_at: string
}

export interface ArchivedHabit {
  id: string
  name: string
  duration: number | null
  current_start_time: string | null
  weekly_days: string[] | null
}

export interface Subhabit {
  id: string
  title: string
  aspect_id: string
  created_at: string
  updated_at: string
}

export interface Aspect {
  id: string
  title: string
  created_at: string
  updated_at: string
  subhabits?: Subhabit[]
}

export interface Behavior {
  id: string
  user_id: string
  name: string
  description?: string
  category?: string
  created_at: string
  updated_at: string
}
