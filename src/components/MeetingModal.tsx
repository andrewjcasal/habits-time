import { format } from 'date-fns'
import { X } from 'lucide-react'
import { Meeting } from '../types'

interface MeetingModalProps {
  isOpen: boolean
  onClose: () => void
  meeting: {
    title: string
    description: string
    start_time: string
    end_time: string
    location: string
    meeting_type: Meeting['meeting_type']
    priority: Meeting['priority']
  }
  onMeetingChange: (meeting: any) => void
  onSubmit: (e: React.FormEvent) => void
  selectedTimeSlot: { time: string; date: Date } | null
  editingMeeting: Meeting | null
}

const MeetingModal = ({
  isOpen,
  onClose,
  meeting,
  onMeetingChange,
  onSubmit,
  selectedTimeSlot,
  editingMeeting
}: MeetingModalProps) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Meeting title"
            value={meeting.title}
            onChange={e => onMeetingChange({ ...meeting, title: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            required
          />

          <textarea
            placeholder="Description (optional)"
            value={meeting.description}
            onChange={e => onMeetingChange({ ...meeting, description: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
            rows={2}
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Start Time</label>
              <input
                type="time"
                value={meeting.start_time}
                onChange={e => onMeetingChange({ ...meeting, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                required
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">End Time</label>
              <input
                type="time"
                value={meeting.end_time}
                onChange={e => onMeetingChange({ ...meeting, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
              <select
                value={meeting.meeting_type}
                onChange={e => onMeetingChange({ ...meeting, meeting_type: e.target.value as Meeting['meeting_type'] })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
              >
                <option value="general">General</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="appointment">Appointment</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Priority</label>
              <select
                value={meeting.priority}
                onChange={e => onMeetingChange({ ...meeting, priority: e.target.value as Meeting['priority'] })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <input
            type="text"
            placeholder="Location (optional)"
            value={meeting.location}
            onChange={e => onMeetingChange({ ...meeting, location: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />

          {selectedTimeSlot && (
            <div className="text-sm text-neutral-600 bg-neutral-50 p-2 rounded">
              <strong>Date:</strong> {format(selectedTimeSlot.date, 'MMM d, yyyy')}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
            >
              {editingMeeting ? 'Update Meeting' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MeetingModal