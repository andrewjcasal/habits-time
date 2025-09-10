import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CalendarNote, HabitNote } from '../types'

export const useCalendarNotes = () => {
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([])
  const [habitNotes, setHabitNotes] = useState<HabitNote[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCalendarNotes = async () => {
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('calendar_notes')
        .select(`
          *,
          habits_notes:note_id (
            id,
            content,
            note_date,
            created_at
          )
        `)
        .order('pinned_date', { ascending: true })

      if (notesError) throw notesError

      setCalendarNotes(notesData || [])
    } catch (error) {
      console.error('Error fetching calendar notes:', error)
    }
  }

  const fetchHabitNotes = async () => {
    try {
      const { data: habitNotesData, error: habitNotesError } = await supabase
        .from('habits_notes')
        .select('*')
        .order('created_at', { ascending: false })

      if (habitNotesError) throw habitNotesError

      setHabitNotes(habitNotesData || [])
    } catch (error) {
      console.error('Error fetching habit notes:', error)
    }
  }

  const addCalendarNote = async (pinnedDate: string, noteId: string) => {
    try {
      const { data, error } = await supabase
        .from('calendar_notes')
        .insert({
          pinned_date: pinnedDate,
          note_id: noteId,
        })
        .select(`
          *,
          habits_notes:note_id (
            id,
            content,
            note_date,
            created_at
          )
        `)
        .single()

      if (error) throw error

      setCalendarNotes(prev => [...prev, data])
      return data
    } catch (error) {
      console.error('Error adding calendar note:', error)
      throw error
    }
  }

  const addHabitNote = async (content: string, noteDate: string) => {
    try {
      const { data, error } = await supabase
        .from('habits_notes')
        .insert({
          content,
          note_date: noteDate,
        })
        .select()
        .single()

      if (error) throw error

      setHabitNotes(prev => [data, ...prev])
      return data
    } catch (error) {
      console.error('Error adding habit note:', error)
      throw error
    }
  }

  const removeCalendarNote = async (calendarNoteId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_notes')
        .delete()
        .eq('id', calendarNoteId)

      if (error) throw error

      setCalendarNotes(prev => prev.filter(note => note.id !== calendarNoteId))
    } catch (error) {
      console.error('Error removing calendar note:', error)
      throw error
    }
  }

  const getNotesForDate = (date: Date) => {
    const dateStr = date.toISOString()
    return calendarNotes.filter(note => {
      const pinnedDate = new Date(note.pinned_date)
      return pinnedDate.toDateString() === date.toDateString()
    })
  }

  const getNotesForDateTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const targetDateTime = new Date(date)
    targetDateTime.setHours(hours, minutes, 0, 0)
    
    return calendarNotes.filter(note => {
      const pinnedDateTime = new Date(note.pinned_date)
      return Math.abs(pinnedDateTime.getTime() - targetDateTime.getTime()) < 60000 // Within 1 minute
    })
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchCalendarNotes(), fetchHabitNotes()])
      setLoading(false)
    }

    loadData()
  }, [])

  return {
    calendarNotes,
    habitNotes,
    loading,
    addCalendarNote,
    addHabitNote,
    removeCalendarNote,
    getNotesForDate,
    getNotesForDateTime,
    refreshNotes: fetchCalendarNotes,
  }
}