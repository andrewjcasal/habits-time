import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Clock, Calendar } from 'lucide-react'
import { getEffectiveHabitStartTime } from '../utils/habitScheduling'
import ModalWrapper from './ModalWrapper'
import SidebarActionButton from './SidebarActionButton'
import { useModal } from '../contexts/ModalContext'

interface HabitModalProps {
  onTimeChange: (habitId: string, date: string, newTime: string, newDuration?: number) => Promise<void>
  onSkip?: (habitId: string, date: string) => Promise<void>
}

const HabitModal = ({ onTimeChange, onSkip }: HabitModalProps) => {
  const { 
    showHabitModal, 
    selectedHabit: habit, 
    selectedHabitDate: selectedDate, 
    closeHabitModal, 
    addMeetingFromHabit 
  } = useModal()
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
      closeHabitModal()
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
      closeHabitModal()
    } catch (error) {
      console.error('Error skipping habit:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!showHabitModal || !habit || !selectedDate) return null

  const rightSidebarActions = (
    <SidebarActionButton onClick={addMeetingFromHabit} title="Add Meeting">
      <Calendar className="w-3 h-3" />
    </SidebarActionButton>
  )

  return (
    <ModalWrapper
      isOpen={showHabitModal}
      onClose={closeHabitModal}
      title="Edit Habit"
      rightSidebarActions={rightSidebarActions}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-1">
        <div className="mb-1">
          <div className="flex items-center mb-1">
            <Clock className="w-3 h-3 text-blue-500 mr-1" />
            <span className="font-medium text-neutral-900 text-sm">{habit.name}</span>
          </div>
          <p className="text-xs text-neutral-600">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        <div className="mb-1">
          <label htmlFor="time" className="block text-xs font-medium text-neutral-700 mb-1">
            Time for Today
          </label>
          <input
            type="time"
            id="time"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
            required
          />
        </div>

        <div className="mb-1">
          <label htmlFor="duration" className="block text-xs font-medium text-neutral-700 mb-1">
            Duration for Today (minutes)
          </label>
          <input
            type="number"
            id="duration"
            value={newDuration}
            onChange={e => setNewDuration(parseInt(e.target.value) || 0)}
            className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
            min="0"
            placeholder="Enter duration in minutes"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Default: {habit.duration || 0} minutes
          </p>
        </div>

        <div className="flex justify-between gap-1 pt-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={closeHabitModal}
              className="px-2 py-1 text-neutral-600 text-xs hover:text-neutral-800"
            >
              Cancel
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Skipping...' : 'Skip Today'}
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !newTime}
            className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Time'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default HabitModal
