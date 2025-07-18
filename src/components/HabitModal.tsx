import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Clock } from 'lucide-react'

interface HabitModalProps {
  isOpen: boolean
  onClose: () => void
  habit: any | null
  selectedDate: Date | null
  onTimeChange: (habitId: string, date: string, newTime: string) => Promise<void>
}

const HabitModal = ({ isOpen, onClose, habit, selectedDate, onTimeChange }: HabitModalProps) => {
  const [newTime, setNewTime] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (habit && selectedDate) {
      // Check if there's a daily log for this date with a scheduled start time
      const dateKey = format(selectedDate, 'yyyy-MM-dd')
      const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateKey)
      const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
      
      // Set initial time to effective habit time (daily log override or default)
      setNewTime(effectiveStartTime || '')
    }
  }, [habit, selectedDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!habit || !selectedDate || !newTime) return

    setLoading(true)
    try {
      const dateString = format(selectedDate, 'yyyy-MM-dd')
      await onTimeChange(habit.id, dateString, newTime)
      onClose()
    } catch (error) {
      console.error('Error updating habit time:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !habit || !selectedDate) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Habit Time</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <Clock className="w-4 h-4 text-blue-500 mr-2" />
              <span className="font-medium text-gray-900">{habit.name}</span>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Date: {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
            {habit.duration && (
              <p className="text-sm text-gray-600">
                Duration: {habit.duration} minutes
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
              New Time
            </label>
            <input
              type="time"
              id="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newTime}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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