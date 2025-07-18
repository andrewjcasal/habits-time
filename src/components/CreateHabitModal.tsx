import { useState } from 'react'
import { X } from 'lucide-react'
import { useHabitTypes } from '../hooks/useHabitTypes'

interface CreateHabitModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateHabit: (habitData: {
    name: string
    duration: number
    habit_type_id: string
    default_start_time: string
    background: string
    benefits: string
    consequences: string
  }) => Promise<void>
}

const CreateHabitModal = ({ isOpen, onClose, onCreateHabit }: CreateHabitModalProps) => {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [habitTypeId, setHabitTypeId] = useState('')
  const [defaultStartTime, setDefaultStartTime] = useState('09:00')
  const [background, setBackground] = useState('')
  const [benefits, setBenefits] = useState('')
  const [consequences, setConsequences] = useState('')
  const [loading, setLoading] = useState(false)

  const { habitTypes } = useHabitTypes()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !habitTypeId) return

    setLoading(true)
    try {
      await onCreateHabit({
        name: name.trim(),
        duration,
        habit_type_id: habitTypeId,
        default_start_time: defaultStartTime,
        background: background.trim(),
        benefits: benefits.trim(),
        consequences: consequences.trim(),
      })
      
      // Reset form
      setName('')
      setDuration(30)
      setHabitTypeId('')
      setDefaultStartTime('09:00')
      setBackground('')
      setBenefits('')
      setConsequences('')
      
      onClose()
    } catch (error) {
      console.error('Error creating habit:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Habit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Habit Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Morning Exercise"
              required
            />
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="480"
            />
          </div>

          <div>
            <label htmlFor="habitType" className="block text-sm font-medium text-gray-700 mb-2">
              Habit Type *
            </label>
            <select
              id="habitType"
              value={habitTypeId}
              onChange={e => setHabitTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select a habit type...</option>
              {habitTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {habitTypeId && (
              <p className="text-xs text-gray-600 mt-1">
                {habitTypes.find(t => t.id === habitTypeId)?.description}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
              Default Start Time
            </label>
            <input
              type="time"
              id="startTime"
              value={defaultStartTime}
              onChange={e => setDefaultStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="background" className="block text-sm font-medium text-gray-700 mb-2">
              Background (optional)
            </label>
            <textarea
              id="background"
              value={background}
              onChange={e => setBackground(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Why is this habit important to you?"
            />
          </div>

          <div>
            <label htmlFor="benefits" className="block text-sm font-medium text-gray-700 mb-2">
              Benefits (optional)
            </label>
            <textarea
              id="benefits"
              value={benefits}
              onChange={e => setBenefits(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="What benefits will you gain from this habit?"
            />
          </div>

          <div>
            <label htmlFor="consequences" className="block text-sm font-medium text-gray-700 mb-2">
              Consequences (optional)
            </label>
            <textarea
              id="consequences"
              value={consequences}
              onChange={e => setConsequences(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="What happens if you don't do this habit?"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !habitTypeId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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