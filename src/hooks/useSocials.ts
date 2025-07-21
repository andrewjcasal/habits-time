import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Social } from '../types'

export function useSocials() {
  const [socials, setSocials] = useState<Social[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSocials()
  }, [])

  const fetchSocials = async () => {
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
        .from('socials')
        .select('*')
        .eq('user_id', user.id)
        .order('platform', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setSocials(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addSocial = async (
    social: Omit<Social, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('socials')
        .insert([{ ...social, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setSocials(prev =>
        [data, ...prev.filter(s => s.id !== data.id)].sort((a, b) => a.platform.localeCompare(b.platform))
      )
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add social')
    }
  }

  const updateSocial = async (
    id: string,
    updates: Partial<Omit<Social, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('socials')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setSocials(prev =>
        prev.map(s => (s.id === id ? data : s)).sort((a, b) => a.platform.localeCompare(b.platform))
      )
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update social')
    }
  }

  const deleteSocial = async (id: string) => {
    try {
      const { error } = await supabase.from('socials').delete().eq('id', id)

      if (error) throw error

      setSocials(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete social')
    }
  }

  return {
    socials,
    loading,
    error,
    addSocial,
    updateSocial,
    deleteSocial,
    refetch: fetchSocials,
  }
}