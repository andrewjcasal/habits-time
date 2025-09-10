import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Plus, Pin, Calendar, FileText, Clock } from 'lucide-react'
import { CalendarNote, HabitNote } from '../types'

interface CalendarNoteModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDate?: Date
  selectedTime?: string
  onAddNote: (content: string, noteDate: string) => Promise<HabitNote>
  onPinNote: (pinnedDate: string, noteId: string) => Promise<CalendarNote>
  habitNotes: HabitNote[]
  existingNotes: CalendarNote[]
}

const CalendarNoteModal: React.FC<CalendarNoteModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  onAddNote,
  onPinNote,
  habitNotes,
  existingNotes,
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [newNoteContent, setNewNoteContent] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<string>('')
  const [selectedDateInput, setSelectedDateInput] = useState('')
  const [selectedTimeInput, setSelectedTimeInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setNewNoteContent('')
      setSelectedNoteId('')
      setMode('new')
      // Set default date and time from props
      if (selectedDate) {
        setSelectedDateInput(format(selectedDate, 'yyyy-MM-dd'))
      }
      if (selectedTime) {
        setSelectedTimeInput(selectedTime)
      }
    }
  }, [isOpen, selectedDate, selectedTime])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !selectedDateInput || !selectedTimeInput) return

    try {
      setLoading(true)
      
      // Create date from inputs
      const [year, month, day] = selectedDateInput.split('-').map(Number)
      const [hours, minutes] = selectedTimeInput.split(':').map(Number)
      const dateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)

      if (mode === 'new' && newNoteContent.trim()) {
        const newNote = await onAddNote(newNoteContent.trim(), selectedDateInput)
        await onPinNote(dateTime.toISOString(), newNote.id)
      } else if (mode === 'existing' && selectedNoteId) {
        await onPinNote(dateTime.toISOString(), selectedNoteId)
      }

      onClose()
    } catch (error) {
      console.error('Error saving calendar note:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-blue-600" />
            <h2 className="text-lg font-semibold text-neutral-900">Pin Note to Calendar</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3">
          <div className="mb-3">
            {/* Date and Time Selection */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label htmlFor="dateInput" className="block text-sm font-medium text-neutral-700 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Date
                </label>
                <input
                  id="dateInput"
                  type="date"
                  value={selectedDateInput}
                  onChange={(e) => setSelectedDateInput(e.target.value)}
                  className="w-full px-2 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="timeInput" className="block text-sm font-medium text-neutral-700 mb-1">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time
                </label>
                <input
                  id="timeInput"
                  type="time"
                  value={selectedTimeInput}
                  onChange={(e) => setSelectedTimeInput(e.target.value)}
                  className="w-full px-2 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`px-2 py-1 text-sm rounded-md transition-colors ${
                  mode === 'new'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <Plus className="w-3 h-3 inline mr-1" />
                New Note
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`px-2 py-1 text-sm rounded-md transition-colors ${
                  mode === 'existing'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                <FileText className="w-3 h-3 inline mr-1" />
                Existing Note
              </button>
            </div>

            {mode === 'new' ? (
              <div>
                <label htmlFor="noteContent" className="block text-sm font-medium text-neutral-700 mb-1">
                  Note Content
                </label>
                <textarea
                  id="noteContent"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Enter your note..."
                  rows={3}
                  className="w-full px-2 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>
            ) : (
              <div>
                <label htmlFor="existingNote" className="block text-sm font-medium text-neutral-700 mb-1">
                  Select Note
                </label>
                <select
                  id="existingNote"
                  value={selectedNoteId}
                  onChange={(e) => setSelectedNoteId(e.target.value)}
                  className="w-full px-2 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                >
                  <option value="">Choose a note...</option>
                  {habitNotes
                    .filter(note => !existingNotes.some(cn => cn.note_id === note.id))
                    .map(note => (
                      <option key={note.id} value={note.id}>
                        {note.content.length > 50 
                          ? `${note.content.substring(0, 50)}...` 
                          : note.content
                        } ({format(new Date(note.created_at), 'MMM d')})
                      </option>
                    ))}
                </select>
                {habitNotes.filter(note => !existingNotes.some(cn => cn.note_id === note.id)).length === 0 && (
                  <p className="text-sm text-neutral-500 mt-1">
                    No available notes to pin. Create a new note or add notes from the Habits page.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedDateInput || !selectedTimeInput || (mode === 'new' && !newNoteContent.trim()) || (mode === 'existing' && !selectedNoteId)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Pinning...' : 'Pin Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CalendarNoteModal