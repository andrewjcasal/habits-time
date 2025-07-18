import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
  created_at: string
  updated_at: string
}

export const useMeetings = (date?: Date) => {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = async () => {
    try {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      let query = supabase.from('meetings').select('*').eq('user_id', user.id)

      // If date is provided, filter by that date
      if (date) {
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        query = query
          .gte('start_time', startOfDay.toISOString())
          .lte('start_time', endOfDay.toISOString())
      }

      const { data, error } = await query.order('start_time', { ascending: true })

      if (error) {
        setError(error.message)
        return
      }

      setMeetings(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [date])

  const addMeeting = async (
    meetingData: Omit<Meeting, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('meetings')
        .insert([{ ...meetingData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setMeetings(prev =>
        [...prev, data].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      )

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add meeting')
      throw err
    }
  }

  const updateMeeting = async (id: string, updates: Partial<Meeting>) => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setMeetings(prev => prev.map(meeting => (meeting.id === id ? data : meeting)))

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meeting')
      throw err
    }
  }

  const deleteMeeting = async (id: string) => {
    try {
      const { error } = await supabase.from('meetings').delete().eq('id', id)

      if (error) throw error

      setMeetings(prev => prev.filter(meeting => meeting.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting')
      throw err
    }
  }

  return {
    meetings,
    loading,
    error,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    refetch: fetchMeetings,
  }
}
