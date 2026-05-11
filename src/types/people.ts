export interface Person {
  id: string
  user_id: string
  name: string
  email?: string
  phone?: string
  company?: string
  role?: string
  notes?: string
  linkedin_url?: string
  twitter_url?: string
  website_url?: string
  last_contact_date?: string
  created_at: string
  updated_at: string
}

export interface ExperienceAttendee {
  id: string
  experience_id: string
  person_id: string
  created_at: string
  person?: Person
}

export interface Experience {
  id: string
  user_id: string
  title: string
  description?: string
  experience_date: string
  type: 'shared' | 'individual' | 'meeting' | 'event' | 'other'
  location?: string
  outcome?: string
  follow_up_needed: boolean
  follow_up_date?: string
  connection_strength: 'strengthened' | 'maintained' | 'weakened' | 'neutral'
  topics_discussed?: string[]
  next_steps?: string
  created_at: string
  updated_at: string
  attendees?: ExperienceAttendee[]
}

export interface Contact {
  id: string
  user_id?: string
  name: string
  company?: string
  role?: string
  email?: string
  phone?: string
  notes?: string
  last_contact_date?: string // ISO string
  created_at?: string
  updated_at?: string
}

export interface NetworkingAction {
  id: number
  user_id: string
  contact_id?: string
  contact_name: string
  company: string
  role: string
  action_taken: string
  follow_up_date?: string
  note?: string
  created_at: string
}
