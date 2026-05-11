export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  color?: string
  hourly_rate?: number
  has_sessions?: boolean
  is_shareable?: boolean
  commitment_total_hours?: number | null
  commitment_weekly_hours?: number | null
  payment_type?: 'manual' | 'upwork'
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  user_id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  estimated_hours?: number
  parent_task_id?: string
  created_at: string
  updated_at: string
  subtasks?: Task[]
}

export interface TaskDailyLog {
  id?: string
  task_id: string
  user_id: string
  log_date: string
  scheduled_start_time: string
  scheduled_end_time: string
  estimated_hours: number
  actual_start_time?: string
  actual_end_time?: string
  completed_at?: string
  time_spent_hours?: number
  notes?: string
  created_at?: string
  updated_at?: string
}
