import { useState, useEffect, useRef } from 'react'
import { X, Calendar, Users, User, Building, MapPin } from 'lucide-react'
import { Experience } from '../types'
import { usePeople } from '../hooks/usePeople'

interface AddExperienceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    experience: Omit<Experience, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'attendees'>,
    attendeeIds: string[]
  ) => Promise<void>
  personId: string
  personName: string
}

export function AddExperienceModal({
  isOpen,
  onClose,
  onSubmit,
  personId,
  personName,
}: AddExperienceModalProps) {
  const { people } = usePeople()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    experience_date: new Date().toISOString().split('T')[0],
    type: 'shared' as const,
    location: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [selectedAttendees, setSelectedAttendees] = useState<{id: string, name: string}[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await onSubmit({
        title: formData.title,
        description: formData.description || undefined,
        experience_date: formData.experience_date,
        type: formData.type,
        location: formData.location || undefined,
        follow_up_needed: false,
        connection_strength: 'neutral',
      }, [personId, ...selectedAttendees.map(a => a.id)])

      // Reset form
      setFormData({
        title: '',
        description: '',
        experience_date: new Date().toISOString().split('T')[0],
        type: 'shared',
        location: '',
      })
      setAttendeeSearch('')
      setSelectedAttendees([])
      setShowDropdown(false)
      onClose()
    } catch (error) {
      console.error('Error adding experience:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <h2 className="text-lg font-semibold text-gray-900">Add Experience with {personName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 pt-0 space-y-3">
          {/* Title and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g., Coffee meeting, Conference, Project collaboration"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={formData.experience_date}
                onChange={e => setFormData({ ...formData, experience_date: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
          </div>

          {/* Type and Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={e =>
                  setFormData({ ...formData, type: e.target.value as Experience['type'] })
                }
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="shared">Shared Experience</option>
                <option value="individual">Individual Experience</option>
                <option value="meeting">Meeting</option>
                <option value="event">Event</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g., Coffee shop, Office, Virtual"
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Other Attendees</label>
            <div className="border border-gray-300 rounded focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent p-1.5 flex flex-wrap items-center gap-1">
              {selectedAttendees.map(attendee => (
                <span
                  key={attendee.id}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {attendee.name}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAttendees(prev => prev.filter(a => a.id !== attendee.id))
                    }
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={attendeeSearch}
                onChange={e => {
                  setAttendeeSearch(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                className="flex-1 min-w-32 border-0 focus:ring-0 text-sm bg-transparent p-0 outline-none"
                placeholder="Add attendees..."
              />
            </div>
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-40 overflow-y-auto">
                {people
                  .filter(
                    person =>
                      person.id !== personId &&
                      !selectedAttendees.some(a => a.id === person.id) &&
                      person.name.toLowerCase().includes(attendeeSearch.toLowerCase())
                  )
                  .map(person => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        setSelectedAttendees(prev => [...prev, { id: person.id, name: person.name }])
                        setAttendeeSearch('')
                        setShowDropdown(false)
                      }}
                      className="w-full px-2 py-1.5 text-left hover:bg-gray-100 focus:bg-gray-100 first:rounded-t last:rounded-b text-sm"
                    >
                      {person.name}
                    </button>
                  ))}
                {people.filter(
                  person =>
                    person.id !== personId &&
                    !selectedAttendees.some(a => a.id === person.id) &&
                    person.name.toLowerCase().includes(attendeeSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-2 py-1.5 text-gray-500 text-sm">No people found</div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              rows={3}
              placeholder="Describe what happened, what you discussed, or key takeaways..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors disabled:opacity-50 text-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
