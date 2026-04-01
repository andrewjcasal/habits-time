import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
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
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [defaultStartTime, setDefaultStartTime] = useState('09:00')
  const [loading, setLoading] = useState(false)

  const { habitTypes } = useHabitTypes()

  // Find the "fixed_time" habit type
  const fixedType = habitTypes.find(t => t.scheduling_rule === 'fixed_time')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !fixedType) return

    setLoading(true)
    try {
      await onCreateHabit({
        name: name.trim(),
        duration,
        habit_type_id: fixedType.id,
        default_start_time: defaultStartTime,
        background: '',
        benefits: '',
        consequences: '',
      })

      setName('')
      setDuration(30)
      setDefaultStartTime('09:00')
      onClose()
    } catch (error) {
      console.error('Error creating habit:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">New Habit</h2>
          <button onClick={onClose} className="p-0.5 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Habit name"
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                min="1"
                max="480"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Start time</label>
              <input
                type="time"
                value={defaultStartTime}
                onChange={e => setDefaultStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !fixedType}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateHabitModal
