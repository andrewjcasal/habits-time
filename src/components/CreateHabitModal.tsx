import { useState, useEffect } from 'react'
import { X, Calendar, CheckSquare } from 'lucide-react'
import { useHabitTypes } from '../hooks/useHabitTypes'

interface CreateHabitModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateHabit: (habitData: {
    name: string
    duration: number
    habit_type_id: string
    default_start_time?: string
    background: string
    benefits: string
    consequences: string
  }) => Promise<void>
}

const CreateHabitModal = ({ isOpen, onClose, onCreateHabit }: CreateHabitModalProps) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'non-calendar'>('calendar')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [habitTypeId, setHabitTypeId] = useState('')
  const [defaultStartTime, setDefaultStartTime] = useState('09:00')
  const [background, setBackground] = useState('')
  const [benefits, setBenefits] = useState('')
  const [consequences, setConsequences] = useState('')
  const [loading, setLoading] = useState(false)

  const { habitTypes } = useHabitTypes()
  
  // Filter habit types based on active tab
  const filteredHabitTypes = habitTypes.filter(type => 
    activeTab === 'calendar' 
      ? type.scheduling_rule !== 'non_calendar'
      : type.scheduling_rule === 'non_calendar'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !habitTypeId) return

    setLoading(true)
    try {
      const habitData = {
        name: name.trim(),
        duration: activeTab === 'calendar' ? duration : 0, // Non-calendar habits don't need duration
        habit_type_id: habitTypeId,
        background: background.trim(),
        benefits: benefits.trim(),
        consequences: consequences.trim(),
      }

      // Only add start time for calendar habits
      if (activeTab === 'calendar') {
        habitData.default_start_time = defaultStartTime
      }

      await onCreateHabit(habitData)
      
      // Reset form
      setName('')
      setDuration(30)
      setHabitTypeId('')
      setDefaultStartTime('09:00')
      setBackground('')
      setBenefits('')
      setConsequences('')
      setActiveTab('calendar')
      
      onClose()
    } catch (error) {
      console.error('Error creating habit:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-select non-calendar habit type when available
  useEffect(() => {
    if (activeTab === 'non-calendar' && habitTypes.length > 0 && !habitTypeId) {
      const nonCalendarType = habitTypes.find(type => type.scheduling_rule === 'non_calendar')
      if (nonCalendarType) {
        setHabitTypeId(nonCalendarType.id)
      }
    }
  }, [habitTypes, activeTab, habitTypeId])

  // Reset form when switching tabs
  const handleTabChange = (tab: 'calendar' | 'non-calendar') => {
    setActiveTab(tab)
    
    if (tab === 'non-calendar') {
      // Auto-select the non-calendar habit type
      const nonCalendarType = habitTypes.find(type => type.scheduling_rule === 'non_calendar')
      if (nonCalendarType) {
        setHabitTypeId(nonCalendarType.id)
      }
    } else {
      setHabitTypeId('') // Clear selection when switching to calendar tab
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Create New Habit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => handleTabChange('calendar')}
            className={`flex-1 px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
              activeTab === 'calendar'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-3 h-3" />
            Calendar Habits
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('non-calendar')}
            className={`flex-1 px-2 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
              activeTab === 'non-calendar'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <CheckSquare className="w-3 h-3" />
            Simple Tracking
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-2 space-y-1">
          {/* Tab-specific description */}
          {activeTab === 'non-calendar' && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mb-1">
              <p className="text-xs text-blue-800">
                <strong>Simple Tracking:</strong> These habits won't appear on your calendar. 
                Perfect for habits you want to track daily without specific timing.
              </p>
            </div>
          )}

          <input
            type="text"
            placeholder="Habit Name *"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs"
            required
          />

          {activeTab === 'calendar' && (
            <input
              type="number"
              placeholder="Duration (minutes)"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 0)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs"
              min="1"
              max="480"
            />
          )}

          {activeTab === 'calendar' && (
            <>
              <select
                value={habitTypeId}
                onChange={e => setHabitTypeId(e.target.value)}
                className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs"
                required
              >
                <option value="">Select habit type *</option>
                {filteredHabitTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {habitTypeId && (
                <p className="text-xs text-gray-600 mt-1">
                  {filteredHabitTypes.find(t => t.id === habitTypeId)?.description}
                </p>
              )}
            </>
          )}

          {activeTab === 'calendar' && (
            <input
              type="time"
              value={defaultStartTime}
              onChange={e => setDefaultStartTime(e.target.value)}
              className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs"
            />
          )}

          <textarea
            placeholder="Background (optional)"
            value={background}
            onChange={e => setBackground(e.target.value)}
            className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs resize-none"
            rows={2}
          />

          <textarea
            placeholder="Benefits (optional)"
            value={benefits}
            onChange={e => setBenefits(e.target.value)}
            className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs resize-none"
            rows={2}
          />

          <textarea
            placeholder="Consequences (optional)"
            value={consequences}
            onChange={e => setConsequences(e.target.value)}
            className="w-full px-1 py-1 border border-gray-300 rounded-md text-xs resize-none"
            rows={2}
          />

          <div className="flex gap-1 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-gray-600 text-xs hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !habitTypeId}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateHabitModal