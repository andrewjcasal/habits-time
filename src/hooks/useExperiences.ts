import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Experience } from '../types'

export function useExperiences(personId?: string) {
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (personId) {
      fetchExperiences()
    }
  }, [personId])

  const fetchExperiences = async () => {
    if (!personId) return

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

      // First, get experience IDs for this person
      const { data: experienceIds, error: idsError } = await supabase
        .from('experience_attendees')
        .select('experience_id')
        .eq('person_id', personId)

      if (idsError) {
        setError(idsError.message)
        return
      }

      const experienceIdList = experienceIds?.map(item => item.experience_id) || []

      if (!experienceIdList || experienceIdList.length === 0) {
        setExperiences([])
        return
      }

      // Then, get the experiences with attendees
      const { data, error: fetchError } = await supabase
        .from('experiences')
        .select(
          `
          *,
          attendees:experience_attendees(
            id,
            person_id,
            created_at,
            person:people(*)
          )
        `
        )
        .eq('user_id', user.id)
        .in('id', experienceIdList)
        .order('experience_date', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setExperiences(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addExperience = async (
    experience: Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'attendees'>,
    attendeeIds: string[]
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // First, create the experience
      const { data: experienceData, error: experienceError } = await supabase
        .from('experiences')
        .insert([{ ...experience, user_id: user.id }])
        .select()
        .single()

      if (experienceError) throw experienceError

      // Then, create the attendee relationships
      if (attendeeIds && attendeeIds.length > 0) {
        const attendeeRecords = attendeeIds.map(personId => ({
          experience_id: experienceData.id,
          person_id: personId,
        }))

        const { error: attendeeError } = await supabase
          .from('experience_attendees')
          .insert(attendeeRecords)

        if (attendeeError) throw attendeeError
      }

      // Fetch the complete experience with attendees
      const { data: completeExperience, error: fetchError } = await supabase
        .from('experiences')
        .select(
          `
          *,
          attendees:experience_attendees(
            id,
            person_id,
            created_at,
            person:people(*)
          )
        `
        )
        .eq('id', experienceData.id)
        .single()

      if (fetchError) throw fetchError

      setExperiences(prev =>
        [completeExperience, ...prev.filter(e => e.id !== completeExperience.id)].sort(
          (a, b) => new Date(b.experience_date).getTime() - new Date(a.experience_date).getTime()
        )
      )
      return completeExperience
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add experience')
    }
  }

  const updateExperience = async (
    id: string,
    updates: Partial<Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('experiences')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setExperiences(prev =>
        prev
          .map(e => (e.id === id ? data : e))
          .sort(
            (a, b) => new Date(b.experience_date).getTime() - new Date(a.experience_date).getTime()
          )
      )
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update experience')
    }
  }

  const deleteExperience = async (id: string) => {
    try {
      const { error } = await supabase.from('experiences').delete().eq('id', id)

      if (error) throw error

      setExperiences(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete experience')
    }
  }

  return {
    experiences,
    loading,
    error,
    addExperience,
    updateExperience,
    deleteExperience,
    refetch: fetchExperiences,
  }
}
