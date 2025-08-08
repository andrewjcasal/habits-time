import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

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

export function useTaskDailyLogs() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveTaskChunks = async (chunks: any[], userId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Convert chunks to task daily log entries
      const taskLogs: Omit<TaskDailyLog, 'id' | 'created_at' | 'updated_at'>[] = chunks.map(chunk => {
        const startTime = `${Math.floor(chunk.startTime).toString().padStart(2, '0')}:${Math.round((chunk.startTime % 1) * 60).toString().padStart(2, '0')}:00`
        const endTime = `${Math.floor(chunk.startTime + chunk.estimated_hours).toString().padStart(2, '0')}:${Math.round(((chunk.startTime + chunk.estimated_hours) % 1) * 60).toString().padStart(2, '0')}:00`
        
        return {
          task_id: chunk.id.split('-chunk-')[0], // Remove chunk suffix to get original task ID
          user_id: userId,
          log_date: format(chunk.date, 'yyyy-MM-dd'),
          scheduled_start_time: startTime,
          scheduled_end_time: endTime,
          estimated_hours: chunk.estimated_hours,
          notes: chunk.title.includes('(') ? chunk.title : undefined
        }
      })

      // Upsert into tasks_daily_logs table to handle conflicts
      const { data, error: insertError } = await supabase
        .from('tasks_daily_logs')
        .upsert(taskLogs, { 
          onConflict: 'task_id,user_id,log_date,scheduled_start_time' 
        })
        .select()

      if (insertError) {
        console.error('Error inserting task daily logs:', insertError)
        setError(insertError.message)
        return null
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save task chunks'
      setError(errorMessage)
      console.error('Error saving task chunks:', err)
      return null
    } finally {
      setLoading(false)
    }
  }

  const clearTaskLogsForDate = async (userId: string, date: Date) => {
    try {
      setLoading(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('tasks_daily_logs')
        .delete()
        .eq('user_id', userId)
        .eq('log_date', format(date, 'yyyy-MM-dd'))

      if (deleteError) {
        console.error('Error clearing task daily logs:', deleteError)
        setError(deleteError.message)
        return false
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear task logs'
      setError(errorMessage)
      console.error('Error clearing task logs:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const clearTaskLogsFromTimeForward = async (userId: string, date: Date, fromTime: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('tasks_daily_logs')
        .delete()
        .eq('user_id', userId)
        .eq('log_date', format(date, 'yyyy-MM-dd'))
        .gte('scheduled_start_time', `${fromTime}:00`)

      if (deleteError) {
        console.error('Error clearing task daily logs from time forward:', deleteError)
        setError(deleteError.message)
        return false
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear task logs from time forward'
      setError(errorMessage)
      console.error('Error clearing task logs from time forward:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const clearTaskLogsForDateRange = async (userId: string, startDate: Date, endDate: Date) => {
    try {
      setLoading(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('tasks_daily_logs')
        .delete()
        .eq('user_id', userId)
        .gte('log_date', format(startDate, 'yyyy-MM-dd'))
        .lte('log_date', format(endDate, 'yyyy-MM-dd'))

      if (deleteError) {
        console.error('Error clearing task daily logs:', deleteError)
        setError(deleteError.message)
        return false
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear task logs'
      setError(errorMessage)
      console.error('Error clearing task logs:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const getTaskLogsForDateRange = async (userId: string, startDate: Date, endDate: Date) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('tasks_daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('log_date', format(startDate, 'yyyy-MM-dd'))
        .lte('log_date', format(endDate, 'yyyy-MM-dd'))
        .order('log_date', { ascending: true })
        .order('scheduled_start_time', { ascending: true })

      if (fetchError) {
        console.error('Error fetching task daily logs:', fetchError)
        setError(fetchError.message)
        return null
      }

      return data as TaskDailyLog[]
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch task logs'
      setError(errorMessage)
      console.error('Error fetching task logs:', err)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    saveTaskChunks,
    clearTaskLogsForDate,
    clearTaskLogsFromTimeForward,
    clearTaskLogsForDateRange,
    getTaskLogsForDateRange
  }
}