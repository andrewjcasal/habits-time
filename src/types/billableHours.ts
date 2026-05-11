export interface BillableHour {
  id: string
  user_id: string
  start_time: string
  end_time: string
  rate: number
  note: string | null
  is_auto_placed: boolean
  created_at: string
  updated_at: string
}
