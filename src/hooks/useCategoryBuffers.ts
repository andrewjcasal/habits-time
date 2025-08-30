import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { CategoryBuffer, BufferUtilization } from '../types'

export const useCategoryBuffers = (currentWeekStart: Date) => {
  const [buffers, setBuffers] = useState<CategoryBuffer[]>([])
  const [utilization, setUtilization] = useState<BufferUtilization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Calculate week bounds for utilization
  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

  useEffect(() => {
    fetchBuffers()
  }, [])

  const fetchBuffers = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('category_buffers')
        .select(`
          *,
          meeting_categories(id, name, color)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setBuffers(data || [])
      fetchUtilization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchUtilization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return


      // Call the database function to get buffer utilization
      const { data, error: fetchError } = await supabase
        .rpc('get_buffer_utilization', {
          p_user_id: user.id,
          p_week_start: weekStart.toISOString(),
          p_week_end: weekEnd.toISOString()
        })

      if (fetchError) {
        console.error('Error fetching buffer utilization:', fetchError)
        return
      }

      setUtilization(data || [])
    } catch (err) {
      console.error('Error fetching buffer utilization:', err)
    }
  }

  const addBuffer = async (categoryId: string, weeklyHours: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('category_buffers')
        .insert([{
          user_id: user.id,
          category_id: categoryId,
          weekly_hours: weeklyHours
        }])
        .select(`
          *,
          meeting_categories(id, name, color)
        `)
        .single()

      if (error) throw error

      setBuffers(prev => [data, ...prev])
      await fetchUtilization() // Refresh utilization after adding buffer
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add buffer')
    }
  }

  const updateBuffer = async (bufferId: string, weeklyHours: number) => {
    try {
      const { data, error } = await supabase
        .from('category_buffers')
        .update({ weekly_hours: weeklyHours })
        .eq('id', bufferId)
        .select(`
          *,
          meeting_categories(id, name, color)
        `)
        .single()

      if (error) throw error

      setBuffers(prev => prev.map(b => (b.id === bufferId ? data : b)))
      await fetchUtilization() // Refresh utilization after updating
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update buffer')
    }
  }

  const deleteBuffer = async (bufferId: string) => {
    try {
      const { error } = await supabase
        .from('category_buffers')
        .delete()
        .eq('id', bufferId)

      if (error) throw error

      setBuffers(prev => prev.filter(b => b.id !== bufferId))
      setUtilization(prev => prev.filter(u => u.buffer_id !== bufferId))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete buffer')
    }
  }

  const getBufferData = () => {
    if (loading || buffers.length === 0) {
      return []
    }
    
    if (buffers.length > 0 && utilization.length === 0) {
      fetchUtilization()
    }
    
    // Combine buffer and utilization data for easier consumption
    const result = buffers.map(buffer => {
      const util = utilization.find(u => u.buffer_id === buffer.id)
      const fallbackUtil = {
        buffer_id: buffer.id,
        category_id: buffer.category_id,
        category_name: buffer.meeting_categories?.name || 'Unknown',
        category_color: buffer.meeting_categories?.color || '#6b7280',
        weekly_hours: parseFloat(buffer.weekly_hours.toString()),
        hours_spent: 0,
        hours_remaining: parseFloat(buffer.weekly_hours.toString()),
        utilization_percentage: 0
      }
      
      return {
        ...buffer,
        utilization: util || fallbackUtil
      }
    })
    
    return result
  }

  const refetch = async () => {
    await fetchBuffers()
  }

  const refreshUtilization = async () => {
    await fetchUtilization()
  }

  return {
    buffers,
    utilization,
    loading,
    error,
    addBuffer,
    updateBuffer,
    deleteBuffer,
    getBufferData,
    refetch,
    refreshUtilization
  }
}