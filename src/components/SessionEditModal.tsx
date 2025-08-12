import { useEffect, useState } from 'react'
import { FileText, Calendar } from 'lucide-react'
import { Session } from '../types'
import ModalWrapper from './ModalWrapper'
import SidebarActionButton from './SidebarActionButton'

interface SessionEditModalProps {
  isOpen: boolean
  onClose: () => void
  session: Session
  onUpdateSession: (sessionId: string, updates: Partial<Session>) => Promise<void>
}

type ViewState = 'edit' | 'addTaskLog' | 'editMeeting'

const SessionEditModal = ({
  isOpen,
  onClose,
  session,
  onUpdateSession
}: SessionEditModalProps) => {
  const [viewState, setViewState] = useState<ViewState>('edit')
  
  // Helper function to format time for inputs
  const formatTimeForInput = (time: string | null | undefined) => {
    if (!time) return ''
    // If time is in HH:MM:SS format, convert to HH:MM
    return time.split(':').slice(0, 2).join(':')
  }

  const [formData, setFormData] = useState({
    scheduled_date: session.scheduled_date,
    actual_start_time: formatTimeForInput(session.actual_start_time),
    actual_end_time: formatTimeForInput(session.actual_end_time),
    notes: session.notes || ''
  })

  // Update form data when session changes
  useEffect(() => {
    setFormData({
      scheduled_date: session.scheduled_date,
      actual_start_time: formatTimeForInput(session.actual_start_time),
      actual_end_time: formatTimeForInput(session.actual_end_time),
      notes: session.notes || ''
    })
    setViewState('edit')
  }, [session])

  // Calculate duration in hours from start and end time
  const calculateDurationHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0
    
    const start = new Date(`1970-01-01T${startTime}:00`)
    const end = new Date(`1970-01-01T${endTime}:00`)
    const durationMs = end.getTime() - start.getTime()
    return durationMs / (1000 * 60 * 60) // Convert to hours
  }

  // Auto-calculate end time when start time changes
  const handleStartTimeChange = (newStartTime: string) => {
    if (!newStartTime) {
      setFormData(prev => ({ ...prev, actual_start_time: newStartTime }))
      return
    }

    // If we have existing start and end times, maintain the duration
    if (session.actual_start_time && session.actual_end_time) {
      const currentDuration = calculateDurationHours(
        formatTimeForInput(session.actual_start_time), 
        formatTimeForInput(session.actual_end_time)
      )
      
      // Calculate new end time maintaining the same duration
      const newStartDateTime = new Date(`1970-01-01T${newStartTime}:00`)
      const newEndDateTime = new Date(newStartDateTime.getTime() + (currentDuration * 60 * 60 * 1000))
      
      // Format new end time back to HH:MM
      const newEndTime = newEndDateTime.toTimeString().slice(0, 5)
      
      setFormData(prev => ({
        ...prev,
        actual_start_time: newStartTime,
        actual_end_time: newEndTime
      }))
    } else {
      // If no existing times, use session's scheduled hours to calculate end time
      const newStartDateTime = new Date(`1970-01-01T${newStartTime}:00`)
      const newEndDateTime = new Date(newStartDateTime.getTime() + (session.scheduled_hours * 60 * 60 * 1000))
      
      const newEndTime = newEndDateTime.toTimeString().slice(0, 5)
      
      setFormData(prev => ({
        ...prev,
        actual_start_time: newStartTime,
        actual_end_time: newEndTime
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Calculate both scheduled and actual hours from start and end time
      const calculatedHours = formData.actual_start_time && formData.actual_end_time 
        ? calculateDurationHours(formData.actual_start_time, formData.actual_end_time)
        : session.scheduled_hours // fallback to existing scheduled_hours if no times

      await onUpdateSession(session.id, {
        scheduled_date: formData.scheduled_date,
        actual_start_time: formData.actual_start_time || null,
        actual_end_time: formData.actual_end_time || null,
        actual_hours: calculatedHours,
        scheduled_hours: calculatedHours,
        notes: formData.notes
      })
      onClose()
    } catch (error) {
      console.error('Error updating session:', error)
    }
  }

  const renderEditSession = () => (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="mb-1">
        <p className="text-xs text-neutral-600">Project: {session.projects?.name}</p>
      </div>

      <input
        type="date"
        value={formData.scheduled_date}
        onChange={e => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
        className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
        required
      />

      <div className="flex gap-1">
        <input
          type="time"
          value={formData.actual_start_time}
          onChange={e => handleStartTimeChange(e.target.value)}
          className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
        />
        <input
          type="time"
          value={formData.actual_end_time}
          onChange={e => setFormData(prev => ({ ...prev, actual_end_time: e.target.value }))}
          className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
        />
      </div>

      {formData.actual_start_time && formData.actual_end_time && (
        <div className="text-xs text-neutral-500">
          Duration: {calculateDurationHours(formData.actual_start_time, formData.actual_end_time).toFixed(2)} hours
        </div>
      )}

      <textarea
        value={formData.notes}
        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs resize-none"
        rows={2}
        placeholder="Session notes..."
      />

      <div className="flex gap-1 justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-neutral-600 text-xs hover:text-neutral-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
        >
          Update
        </button>
      </div>
    </form>
  )

  const renderAddTaskLog = () => (
    <div className="space-y-1">
      <p className="text-xs text-neutral-600 mb-2">
        Create a task log for this session
      </p>
      
      <select className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs">
        <option value="">Choose a task...</option>
        {/* This would be populated with available tasks */}
      </select>

      <div className="flex gap-1">
        <input
          type="time"
          defaultValue={formData.actual_start_time}
          className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
        />
        <input
          type="number"
          min="0.25"
          max="8"
          step="0.25"
          defaultValue="1"
          className="w-16 px-1 py-1 border border-neutral-300 rounded-md text-xs"
          placeholder="Hours"
        />
      </div>

      <textarea
        className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs resize-none"
        rows={2}
        placeholder="Task log notes..."
      />

      <div className="flex gap-1 justify-between pt-1">
        <button
          type="button"
          onClick={() => setViewState('edit')}
          className="px-2 py-1 text-neutral-600 text-xs hover:text-neutral-800"
        >
          Back
        </button>
        <button
          type="button"
          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
        >
          Create Task Log
        </button>
      </div>
    </div>
  )

  const renderEditMeeting = () => (
    <div className="space-y-1">
      <p className="text-xs text-neutral-600 mb-2">
        Create or edit meeting for this session
      </p>
      
      <input
        type="text"
        className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
        placeholder="Meeting title..."
      />

      <div className="flex gap-1">
        <input
          type="time"
          defaultValue={formData.actual_start_time}
          className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
        />
        <input
          type="time"
          defaultValue={formData.actual_end_time}
          className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
        />
      </div>

      <textarea
        className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs resize-none"
        rows={2}
        placeholder="Meeting description..."
      />

      <div className="flex gap-1 justify-between pt-1">
        <button
          type="button"
          onClick={() => setViewState('edit')}
          className="px-2 py-1 text-neutral-600 text-xs hover:text-neutral-800"
        >
          Back
        </button>
        <button
          type="button"
          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
        >
          Create Meeting
        </button>
      </div>
    </div>
  )

  const getTitle = () => {
    switch (viewState) {
      case 'addTaskLog':
        return 'Add Task Log'
      case 'editMeeting':
        return 'Edit Meeting'
      default:
        return 'Edit Session'
    }
  }

  const renderContent = () => {
    switch (viewState) {
      case 'addTaskLog':
        return renderAddTaskLog()
      case 'editMeeting':
        return renderEditMeeting()
      default:
        return renderEditSession()
    }
  }

  const rightSidebarActions = (
    <>
      <SidebarActionButton
        onClick={() => setViewState(viewState === 'addTaskLog' ? 'edit' : 'addTaskLog')}
        title={viewState === 'addTaskLog' ? 'Back to Session' : 'Add Task Log'}
      >
        <FileText className="w-3 h-3" />
      </SidebarActionButton>
      <SidebarActionButton
        onClick={() => setViewState(viewState === 'editMeeting' ? 'edit' : 'editMeeting')}
        title={viewState === 'editMeeting' ? 'Back to Session' : 'Edit Meeting'}
      >
        <Calendar className="w-3 h-3" />
      </SidebarActionButton>
    </>
  )

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
      rightSidebarActions={rightSidebarActions}
      maxWidth="lg"
    >
      {renderContent()}
    </ModalWrapper>
  )
}

export default SessionEditModal