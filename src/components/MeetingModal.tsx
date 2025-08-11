import { format, subWeeks } from 'date-fns'
import { X, ChevronDown, FileText, Calendar } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { Meeting } from '../types'
import { supabase } from '../lib/supabase'
import TaskDailyLogModal from './TaskDailyLogModal'

interface Category {
  id: string
  name: string
  color: string
}

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
    category_id?: string
  }
  onMeetingChange: (meeting: any) => void
  onSubmit: (e: React.FormEvent) => void
  selectedTimeSlot: { time: string; date: Date } | null
  editingMeeting: Meeting | null
  onDelete?: () => void
  onTaskLogCreated?: () => void
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
  onTaskLogCreated,
}: MeetingModalProps) => {
  const [previousTitles, setPreviousTitles] = useState<
    { title: string; count: number; lastUsed: Date }[]
  >([])
  const [showTitleDropdown, setShowTitleDropdown] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [showTaskLogModal, setShowTaskLogModal] = useState(false)
  const [localTitle, setLocalTitle] = useState(meeting.title)
  const [showTaskLogForm, setShowTaskLogForm] = useState(false)

  // Sync local title with meeting prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTitle(meeting.title)
      setShowTaskLogForm(false) // Reset task log form state
    }
  }, [isOpen, meeting.title])

  // Fetch previous meeting titles when modal opens (only for new meetings)
  useEffect(() => {
    if (isOpen && !editingMeeting) {
      fetchPreviousTitles()
    }
  }, [isOpen, editingMeeting])

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories()
    }
  }, [isOpen])

  const fetchCategories = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('meeting_categories')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name')

      if (error) {
        console.error('Error fetching categories:', error)
        return
      }

      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchPreviousTitles = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const twoWeeksAgo = subWeeks(new Date(), 2)

      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('title, start_time')
        .eq('user_id', user.id)
        .not('title', 'is', null)
        .not('title', 'eq', '')
        .order('start_time', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching previous meeting titles:', error)
        return
      }

      // Group by title and calculate usage stats
      const titleStats = new Map<string, { count: number; lastUsed: Date; recentCount: number }>()

      meetings?.forEach(meeting => {
        const title = meeting.title.trim()
        const startTime = new Date(meeting.start_time)
        const isRecent = startTime >= twoWeeksAgo

        if (titleStats.has(title)) {
          const stats = titleStats.get(title)!
          stats.count++
          if (startTime > stats.lastUsed) {
            stats.lastUsed = startTime
          }
          if (isRecent) {
            stats.recentCount++
          }
        } else {
          titleStats.set(title, {
            count: 1,
            lastUsed: startTime,
            recentCount: isRecent ? 1 : 0,
          })
        }
      })

      // Convert to array and sort: recent usage first, then by total usage, then alphabetically
      const sortedTitles = Array.from(titleStats.entries())
        .map(([title, stats]) => ({
          title,
          count: stats.count,
          lastUsed: stats.lastUsed,
          recentCount: stats.recentCount,
        }))
        .sort((a, b) => {
          // First, prioritize titles used in the last 2 weeks
          if (a.recentCount > 0 && b.recentCount === 0) return -1
          if (b.recentCount > 0 && a.recentCount === 0) return 1

          // Within each group, sort by recent usage count, then total count, then alphabetically
          if (a.recentCount !== b.recentCount) return b.recentCount - a.recentCount
          if (a.count !== b.count) return b.count - a.count
          return a.title.localeCompare(b.title)
        })

      setPreviousTitles(sortedTitles)
    } catch (error) {
      console.error('Error fetching previous meeting titles:', error)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        setShowTitleDropdown(false)
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.title-dropdown-container')) {
        setShowTitleDropdown(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`overflow-hidden rounded-lg w-full mx-4 ${
          selectedTimeSlot ? 'max-w-md' : 'max-w-sm'
        }`}
      >
        <div className="flex bg-neutral-100">
          {/* Main content area */}
          <div className="bg-white p-2 flex-1 rounded-r-lg">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-neutral-900">
                {showTaskLogForm ? 'Add Task Log' : editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
              </h2>
              <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-3 h-3" />
              </button>
            </div>

            {!showTaskLogForm ? (
              <form
                onSubmit={e => {
                  // Update the meeting with the local title before submitting
                  onMeetingChange({ ...meeting, title: localTitle })
                  onSubmit(e)
                }}
                className="space-y-1"
              >
                <div className="relative title-dropdown-container">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Meeting title"
                      value={localTitle}
                      onChange={e => {
                        const newTitle = e.target.value
                        setLocalTitle(newTitle)
                        // Show/hide dropdown based on title length
                        if (newTitle.length > 3) {
                          setShowTitleDropdown(false)
                        } else if (
                          newTitle.length <= 3 &&
                          !editingMeeting &&
                          previousTitles.length > 0
                        ) {
                          setShowTitleDropdown(true)
                        }
                      }}
                      onFocus={() => {
                        // Only show dropdown if not editing, has previous titles, and title is 3 chars or less
                        const shouldShow =
                          !editingMeeting && previousTitles.length > 0 && localTitle.length <= 3
                        setShowTitleDropdown(shouldShow)
                      }}
                      className="w-full px-1 py-1 pr-6 border border-neutral-300 rounded-md text-xs"
                      autoFocus
                      required
                    />
                    {!editingMeeting && previousTitles.length > 0 && localTitle.length <= 3 && (
                      <button
                        type="button"
                        onClick={() => setShowTitleDropdown(!showTitleDropdown)}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {!editingMeeting &&
                    showTitleDropdown &&
                    previousTitles.length > 0 &&
                    localTitle.length <= 3 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
                        {(() => {
                          const filteredTitles = previousTitles
                            .filter(
                              titleData =>
                                localTitle.length === 0 ||
                                titleData.title.toLowerCase().includes(localTitle.toLowerCase())
                            )
                            .slice(0, 10)

                          if (filteredTitles.length === 0) {
                            return (
                              <div className="px-2 py-1 text-xs text-neutral-500">
                                No matching titles found
                              </div>
                            )
                          }

                          return filteredTitles.map((titleData, index) => {
                            const isRecent = titleData.recentCount > 0
                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  setLocalTitle(titleData.title)
                                  setShowTitleDropdown(false)
                                }}
                                className="w-full text-left px-2 py-1 text-xs hover:bg-neutral-50 flex items-center justify-between"
                              >
                                <span className="truncate">{titleData.title}</span>
                                <div className="flex items-center gap-1 text-neutral-400 flex-shrink-0">
                                  {isRecent && <span className="text-blue-500 text-xs">●</span>}
                                  <span className="text-xs">{titleData.count}</span>
                                </div>
                              </button>
                            )
                          })
                        })()}
                      </div>
                    )}
                </div>

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
                    onChange={e => {
                      const newStartTime = e.target.value

                      // Calculate current duration in minutes
                      const startTime = new Date(`1970-01-01T${meeting.start_time}:00`)
                      const endTime = new Date(`1970-01-01T${meeting.end_time}:00`)
                      const durationMs = endTime.getTime() - startTime.getTime()

                      // Calculate new end time maintaining the same duration
                      const newStartDateTime = new Date(`1970-01-01T${newStartTime}:00`)
                      const newEndDateTime = new Date(newStartDateTime.getTime() + durationMs)

                      // Format new end time back to HH:MM
                      const newEndTime = newEndDateTime.toTimeString().slice(0, 5)

                      onMeetingChange({
                        ...meeting,
                        start_time: newStartTime,
                        end_time: newEndTime,
                      })
                    }}
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
                      onMeetingChange({
                        ...meeting,
                        priority: e.target.value as Meeting['priority'],
                      })
                    }
                    className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <select
                    value={meeting.category_id || ''}
                    onChange={e =>
                      onMeetingChange({
                        ...meeting,
                        category_id: e.target.value || undefined,
                      })
                    }
                    className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
                  >
                    <option value="">No category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
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
                    {selectedTimeSlot && (
                      <button
                        type="button"
                        onClick={() => setShowTaskLogModal(true)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        + Task Log
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                    >
                      {editingMeeting ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-neutral-600 mb-2">
                  Create a task log for{' '}
                  {selectedTimeSlot ? format(selectedTimeSlot.date, 'MMM d, yyyy') : 'today'}
                </p>
                <div>
                  <select
                    className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
                    required
                  >
                    <option value="">Select a task...</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  <input
                    type="time"
                    defaultValue={selectedTimeSlot?.time || ''}
                    className="flex-1 px-1 py-1 border border-neutral-300 rounded-md text-xs"
                    required
                  />
                  <input
                    type="number"
                    min="0.25"
                    max="8"
                    step="0.25"
                    defaultValue="1"
                    placeholder="Hours"
                    className="w-16 px-1 py-1 border border-neutral-300 rounded-md text-xs"
                    required
                  />
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs resize-none"
                  rows={2}
                />
                <div className="flex gap-1 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTaskLogForm(false)}
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
            )}
          </div>

          {/* Sidebar when opened from time slot */}
          {selectedTimeSlot && !editingMeeting && (
            <div className="w-16 py-2 px-1 rounded-r-lg">
              <div className="flex flex-col gap-1">
                {!showTaskLogForm ? (
                  <button
                    type="button"
                    onClick={() => setShowTaskLogForm(true)}
                    className="w-5 h-5 flex items-center justify-center bg-white hover:bg-neutral-50 rounded text-xs text-neutral-600 hover:text-neutral-800 transition-colors shadow-sm"
                    title="Add Task Log"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTaskLogForm(false)}
                    className="w-5 h-5 flex items-center justify-center bg-white hover:bg-neutral-50 rounded text-xs text-neutral-600 hover:text-neutral-800 transition-colors shadow-sm"
                    title="Back to Meeting"
                  >
                    <Calendar className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <TaskDailyLogModal
        isOpen={showTaskLogModal}
        onClose={() => setShowTaskLogModal(false)}
        selectedDate={selectedTimeSlot?.date || new Date(meeting.date)}
        selectedTimeSlot={selectedTimeSlot}
        onTaskLogCreated={() => {
          setShowTaskLogModal(false)
          if (onTaskLogCreated) {
            onTaskLogCreated()
          }
        }}
      />
    </div>
  )
}

export default MeetingModal
