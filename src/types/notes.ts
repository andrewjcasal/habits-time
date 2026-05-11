import { HabitNote } from './habits'

export interface Issue {
  id: string
  name: string
  is_archived: boolean
}

export interface CalendarNote {
  id: string
  pinned_date: string
  note_id: string
  user_id: string
  created_at: string
  updated_at: string
  habits_notes?: HabitNote
}
