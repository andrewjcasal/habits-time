import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Clock } from 'lucide-react'
import { getEffectiveHabitStartTime } from '../utils/habitScheduling'

interface HabitModalProps {
  isOpen: boolean
  onClose: () => void
  habit: any | null
  selectedDate: Date | null
  onTimeChange: (habitId: string, date: string, newTime: string, newDuration?: number) => Promise<void>
  onSkip?: (habitId: string, date: string) => Promise<void>
}

const HabitModal = ({ isOpen, onClose, habit, selectedDate, onTimeChange, onSkip }: HabitModalProps) => {
  const [newTime, setNewTime] = useState('')
  const [newDuration, setNewDuration] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (habit && selectedDate) {
      // Check if there's a daily log for this date with a scheduled start time
      const dateKey = format(selectedDate, 'yyyy-MM-dd')
      const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateKey)
      const effectiveStartTime = getEffectiveHabitStartTime(habit, dateKey, dailyLog)
      const effectiveDuration = dailyLog?.duration || habit.duration || 0

      // Set initial time to effective habit time (with pull-back applied if needed)
      setNewTime(effectiveStartTime || '')
      setNewDuration(effectiveDuration)
    }
  }, [habit, selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!habit || !selectedDate || !newTime) return

    setLoading(true)
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd')
      await onTimeChange(habit.id, dateString, newTime, newDuration)
      onClose()
    } catch (error) {
      console.error('Error updating habit:', error)
    } finally {
      setLoading(false)
    }
    window.location.reload()
  }

  const handleSkip = async () => {
    if (!habit || !selectedDate || !onSkip) return

    setLoading(true)
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd')
      await onSkip(habit.id, dateString)
      onClose()
    } catch (error) {
      console.error('Error skipping habit:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !habit || !selectedDate) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Habit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3">
          <div className="mb-3">
            <div className="flex items-center mb-1">
              <Clock className="w-4 h-4 text-blue-500 mr-2" />
              <span className="font-medium text-gray-900">{habit.name}</span>
            </div>
            <p className="text-sm text-gray-600">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <div className="mb-3">
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
              Time for Today
            </label>
            <input
              type="time"
              id="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration for Today (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={newDuration}
              onChange={e => setNewDuration(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
              placeholder="Enter duration in minutes"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: {habit.duration || 0} minutes
            </p>
          </div>

          <div className="flex justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              {onSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={loading}
                  className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {loading ? 'Skipping...' : 'Skip Today'}
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !newTime}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? 'Saving...' : 'Save Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default HabitModal
