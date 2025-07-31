import { format } from 'date-fns'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { Meeting } from '../types'

interface MeetingModalProps {
  isOpen: boolean
  onClose: () => void
  meeting: {
    title: string
    description: string
    start_time: string
    end_time: string
    date: string
    location: string
    meeting_type: Meeting['meeting_type']
    priority: Meeting['priority']
  }
  onMeetingChange: (meeting: any) => void
  onSubmit: (e: React.FormEvent) => void
  selectedTimeSlot: { time: string; date: Date } | null
  editingMeeting: Meeting | null
  onDelete?: () => void
}

const MeetingModal = ({
  isOpen,
  onClose,
  meeting,
  onMeetingChange,
  onSubmit,
  selectedTimeSlot,
  editingMeeting,
  onDelete,
}: MeetingModalProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-2 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-neutral-900">
            {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-3 h-3" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-1">
          <input
            type="text"
            placeholder="Meeting title"
            value={meeting.title}
            onChange={e => onMeetingChange({ ...meeting, title: e.target.value })}
            className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
            autoFocus
            required
          />

          <div className="flex gap-1">
            <input
              type="date"
              value={meeting.date}
              onChange={e => onMeetingChange({ ...meeting, date: e.target.value })}
              className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
              required
            />
            <input
              type="time"
              value={meeting.start_time}
              onChange={e => onMeetingChange({ ...meeting, start_time: e.target.value })}
              className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
              required
            />
            <input
              type="time"
              value={meeting.end_time}
              onChange={e => onMeetingChange({ ...meeting, end_time: e.target.value })}
              className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
              required
            />
          </div>

          <div className="flex gap-1">
            <select
              value={meeting.meeting_type}
              onChange={e =>
                onMeetingChange({
                  ...meeting,
                  meeting_type: e.target.value as Meeting['meeting_type'],
                })
              }
              className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
            >
              <option value="general">General</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="appointment">Appointment</option>
            </select>

            <select
              value={meeting.priority}
              onChange={e =>
                onMeetingChange({ ...meeting, priority: e.target.value as Meeting['priority'] })
              }
              className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Location (optional)"
            value={meeting.location}
            onChange={e => onMeetingChange({ ...meeting, location: e.target.value })}
            className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
          />

          <textarea
            placeholder="Description (optional)"
            value={meeting.description}
            onChange={e => onMeetingChange({ ...meeting, description: e.target.value })}
            className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs resize-none"
            rows={2}
          />

          <div className="flex gap-1 justify-between pt-1">
            {editingMeeting && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                Delete
              </button>
            )}
            <div className="flex gap-1 ml-auto">
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
                {editingMeeting ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MeetingModal
