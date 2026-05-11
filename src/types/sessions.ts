export interface Contract {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'cancelled'
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  project_id: string
  scheduled_date: string
  scheduled_hours: number
  actual_start_time?: string // HH:MM:SS
  actual_end_time?: string // HH:MM:SS
  actual_hours?: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
  projects?: {
    name: string
    color?: string
  }
}

export interface ContractSession {
  id: string
  contract_id: string
  session_id: string
  created_at: string
}
