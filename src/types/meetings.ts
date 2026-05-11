export interface MeetingCategory {
  id: string
  user_id: string
  name: string
  description?: string
  color: string
  created_at: string
  updated_at: string
}

export interface Meeting {
  id: string
  user_id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  attendees?: string[]
  meeting_type: 'general' | 'work' | 'personal' | 'appointment'
  priority: 'low' | 'medium' | 'high'
  status: 'scheduled' | 'completed' | 'cancelled'
  category_id?: string
  google_event_id?: string
  user_calendar_id?: string
  is_ignored?: boolean
  created_at: string
  updated_at: string
}
