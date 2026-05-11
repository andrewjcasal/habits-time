export interface CategoryBuffer {
  id: string
  user_id: string
  category_id: string
  weekly_hours: number
  created_at: string
  updated_at: string
}

export interface BufferUtilization {
  buffer_id: string
  category_id: string
  category_name: string
  category_color: string
  weekly_hours: number
  hours_spent: number
  hours_remaining: number
  utilization_percentage: number
}

export interface BufferBlock {
  id: string
  buffer_id: string
  category_id: string
  category_name: string
  category_color: string
  start_time: number // hours in decimal (e.g., 9.5 for 9:30)
  duration: number // hours in decimal
  remaining_hours: number
  date: Date
  dateStr: string
}

export interface BufferTime {
  id: string
  title: string
  startTime: string
  endTime: string
  duration: number // in minutes
  date: Date
  dateStr: string
  isBuffer: true
  isReduced: boolean
  isActive: boolean
}
