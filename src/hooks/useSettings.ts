import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface UserSettings {
  id?: string
  user_id: string
  work_hours_start: string
  work_hours_end: string
  week_ending_day: string // 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  week_ending_time: string // HH:MM format
  week_ending_timezone: string // e.g., 'America/New_York'
  weekend_days: string[] // Array of weekday names like ['saturday', 'sunday']
  todoist_api_key?: string
  created_at?: string
  updated_at?: string
}

interface UseSettingsReturn {
  settings: UserSettings | null
  loading: boolean
  error: string | null
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>
  getWorkHoursRange: () => { start: number; end: number }
}

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch settings from database
  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found"
        throw error
      }

      if (data) {
        setSettings(data)
      } else {
        // Create default settings if none exist
        const defaultSettings = {
          user_id: user.id,
          work_hours_start: '07:00:00',
          work_hours_end: '23:00:00',
          week_ending_day: 'sunday',
          week_ending_time: '20:30',
          week_ending_timezone: 'America/New_York',
          weekend_days: ['saturday', 'sunday'],
        }

        const { data: newSettings, error: createError } = await supabase
          .from('user_settings')
          .insert([defaultSettings])
          .select()
          .single()

        if (createError) throw createError
        setSettings(newSettings)
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch settings')

      // Fallback to defaults if database fails
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setSettings({
          user_id: user.id,
          work_hours_start: '07:00:00',
          work_hours_end: '23:00:00',
          week_ending_day: 'sunday',
          week_ending_time: '20:30',
          week_ending_timezone: 'America/New_York',
          weekend_days: ['saturday', 'sunday'],
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Update settings in database
  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      setSettings(data)
    } catch (err) {
      console.error('Error updating settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      throw err
    }
  }

  // Get work hours as numbers (24-hour format)
  const getWorkHoursRange = () => {
    if (!settings) {
      return { start: 7, end: 23 } // Default fallback
    }

    const start = parseInt(settings.work_hours_start.split(':')[0], 10)
    const end = parseInt(settings.work_hours_end.split(':')[0], 10)

    return { start, end }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return {
    settings,
    loading,
    error,
    updateSettings,
    getWorkHoursRange,
  }
}
