import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MeetingCategory, Meeting } from '../types'
import { TimeRange } from '../utils/timeRanges'
import { calculateMeetingHoursByCategory, CategoryMeetingData } from '../utils/meetingHoursCalculation'

export const useMeetingCategories = () => {
  const [categories, setCategories] = useState<MeetingCategory[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('meeting_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (categoriesError) {
        setError(categoriesError.message)
        return
      }

      // Fetch all meetings
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true })

      if (meetingsError) {
        setError(meetingsError.message)
        return
      }

      setCategories(categoriesData || [])
      setMeetings(meetingsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getCategoryMeetingData = (timeRange: TimeRange): CategoryMeetingData[] => {
    return calculateMeetingHoursByCategory(meetings, categories, timeRange)
  }

  const addCategory = async (categoryData: Omit<MeetingCategory, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('meeting_categories')
        .insert([{ ...categoryData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category')
      throw err
    }
  }

  const updateCategory = async (id: string, updates: Partial<MeetingCategory>) => {
    try {
      const { data, error } = await supabase
        .from('meeting_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setCategories(prev => prev.map(cat => cat.id === id ? data : cat))
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category')
      throw err
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('meeting_categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCategories(prev => prev.filter(cat => cat.id !== id))
      // Refresh meetings to update category_id references
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
      throw err
    }
  }

  return {
    categories,
    meetings,
    loading,
    error,
    getCategoryMeetingData,
    addCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchData,
  }
}