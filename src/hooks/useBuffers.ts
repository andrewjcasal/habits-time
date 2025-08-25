import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CategoryBuffer, BufferUtilization, MeetingCategory } from '../types'

export const useBuffers = () => {
  const [buffers, setBuffers] = useState<CategoryBuffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBuffers = async () => {
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

      const { data, error: fetchError } = await supabase
        .from('category_buffers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setBuffers(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBuffers()
  }, [])

  const createBuffer = async (bufferData: Omit<CategoryBuffer, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('category_buffers')
        .insert([{ ...bufferData, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setBuffers(prev => [data, ...prev])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create buffer')
      throw err
    }
  }

  const updateBuffer = async (id: string, updates: Partial<Omit<CategoryBuffer, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('category_buffers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setBuffers(prev => prev.map(buffer => buffer.id === id ? data : buffer))
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update buffer')
      throw err
    }
  }

  const deleteBuffer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('category_buffers')
        .delete()
        .eq('id', id)

      if (error) throw error

      setBuffers(prev => prev.filter(buffer => buffer.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete buffer')
      throw err
    }
  }

  const getBufferUtilization = async (weekStart: string, weekEnd: string): Promise<BufferUtilization[]> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase.rpc('get_buffer_utilization', {
        p_user_id: user.id,
        p_week_start: weekStart,
        p_week_end: weekEnd,
      })

      if (error) throw error

      return data || []
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get buffer utilization')
      throw err
    }
  }

  const getBufferForCategory = (categoryId: string): CategoryBuffer | undefined => {
    return buffers.find(buffer => buffer.category_id === categoryId)
  }

  const getBuffersWithCategories = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('category_buffers')
        .select(`
          *,
          meeting_categories (
            id,
            name,
            color,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get buffers with categories')
      throw err
    }
  }

  return {
    buffers,
    loading,
    error,
    createBuffer,
    updateBuffer,
    deleteBuffer,
    getBufferUtilization,
    getBufferForCategory,
    getBuffersWithCategories,
    refetch: fetchBuffers,
  }
}