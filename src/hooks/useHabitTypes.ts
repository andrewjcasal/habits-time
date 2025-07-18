import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface HabitType {
  id: string
  name: string
  description: string | null
  scheduling_rule: string
}

export function useHabitTypes() {
  const [habitTypes, setHabitTypes] = useState<HabitType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHabitTypes = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('habits_types')
        .select('*')
        .order('name')

      if (error) throw error

      setHabitTypes(data || [])
    } catch (err) {
      console.error('Error fetching habit types:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHabitTypes()
  }, [])

  return {
    habitTypes,
    loading,
    error,
    refetch: fetchHabitTypes,
  }
}