export interface ActivityType {
  id: string
  name: string
  is_favorite?: boolean
}

export interface Essential {
  id: string
  user_id: string
  activity_type_id: string
  daily_minutes: number
  created_at: string
  updated_at: string
}

export interface DailyOverride {
  id: string
  user_id: string
  essential_id: string
  date: string
  minutes: number
  created_at: string
  updated_at: string
}
