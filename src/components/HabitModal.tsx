import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Clock, Calendar, Play, Pause, SkipForward, Check } from 'lucide-react'
import { getEffectiveHabitStartTime } from '../utils/habitScheduling'
import { supabase } from '../lib/supabase'
import ModalWrapper from './ModalWrapper'
import SidebarActionButton from './SidebarActionButton'
import { useModal } from '../contexts/ModalContext'

interface HabitModalProps {
  onTimeChange: (habitId: string, date: string, newTime: string, newDuration?: number) => Promise<void>
  onSkip?: (habitId: string, date: string) => Promise<void>
}

interface Subhabit {
  id: string
  title: string
  duration_minutes: number | null
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

  // Subhabits & routine timer state
  const [subhabits, setSubhabits] = useState<Subhabit[]>([])
  const [routineActive, setRoutineActive] = useState(false)
  const [currentSubhabitIndex, setCurrentSubhabitIndex] = useState(0)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (habit && selectedDate) {
      const dateKey = format(selectedDate, 'yyyy-MM-dd')
      const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateKey)
      const effectiveStartTime = getEffectiveHabitStartTime(habit, dateKey, dailyLog)
      const effectiveDuration = dailyLog?.duration || habit.duration || 0

      setNewTime(effectiveStartTime || '')
      setNewDuration(effectiveDuration)
      fetchSubhabits()
    }
  }, [habit, selectedDate])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const fetchSubhabits = async () => {
    if (!habit) return
    const { data } = await supabase
      .from('cassian_subhabits')
      .select('*')
      .eq('habit_id', habit.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setSubhabits(data || [])
  }

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

  // Routine timer functions
  const startRoutine = () => {
    setRoutineActive(true)
    setCurrentSubhabitIndex(0)
    setCompletedIndices(new Set())
    startSubhabitTimer(0)
  }

  const startSubhabitTimer = (index: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const sub = subhabits[index]
    const duration = (sub?.duration_minutes || 5) * 60
    setSecondsRemaining(duration)
    setTotalSeconds(duration)
    setIsPaused(false)

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          // Auto-advance to next
          if (timerRef.current) clearInterval(timerRef.current)
          setCompletedIndices(ci => new Set([...ci, index]))
          if (index < subhabits.length - 1) {
            setCurrentSubhabitIndex(index + 1)
            setTimeout(() => startSubhabitTimer(index + 1), 300)
          } else {
            setRoutineActive(false)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const togglePause = () => {
    if (isPaused) {
      // Resume
      setIsPaused(false)
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            const idx = currentSubhabitIndex
            setCompletedIndices(ci => new Set([...ci, idx]))
            if (idx < subhabits.length - 1) {
              setCurrentSubhabitIndex(idx + 1)
              setTimeout(() => startSubhabitTimer(idx + 1), 300)
            } else {
              setRoutineActive(false)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      // Pause
      if (timerRef.current) clearInterval(timerRef.current)
      setIsPaused(true)
    }
  }

  const skipToNext = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCompletedIndices(ci => new Set([...ci, currentSubhabitIndex]))
    if (currentSubhabitIndex < subhabits.length - 1) {
      const next = currentSubhabitIndex + 1
      setCurrentSubhabitIndex(next)
      startSubhabitTimer(next)
    } else {
      setRoutineActive(false)
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = totalSeconds > 0 ? (totalSeconds - secondsRemaining) / totalSeconds : 0
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference * (1 - progress)

  if (!showHabitModal || !habit || !selectedDate) return null

  const rightSidebarActions = (
    <SidebarActionButton onClick={addMeetingFromHabit} title="Add Meeting">
      <Calendar className="w-3 h-3" />
    </SidebarActionButton>
  )

  // Routine timer view
  if (routineActive) {
    const currentSub = subhabits[currentSubhabitIndex]
    return (
      <ModalWrapper
        isOpen={showHabitModal}
        onClose={() => {
          if (timerRef.current) clearInterval(timerRef.current)
          setRoutineActive(false)
          closeHabitModal()
        }}
        title={habit.name}
        maxWidth="sm"
      >
        <div className="flex flex-col items-center py-4">
          {/* Radial timer */}
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={secondsRemaining <= 10 ? '#ef4444' : '#3b82f6'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-semibold text-neutral-800">{formatTime(secondsRemaining)}</span>
            </div>
          </div>

          {/* Current subhabit */}
          <div className="text-sm font-medium text-neutral-900 mb-1">{currentSub?.title}</div>
          <div className="text-xs text-neutral-500 mb-4">
            {currentSubhabitIndex + 1} of {subhabits.length}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={skipToNext}
              className="p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors"
              title="Skip to next"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Subhabit list */}
          <div className="w-full mt-4 space-y-1">
            {subhabits.map((sub, i) => (
              <div
                key={sub.id}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  i === currentSubhabitIndex ? 'bg-blue-50 text-blue-800 font-medium' :
                  completedIndices.has(i) ? 'text-neutral-400 line-through' :
                  'text-neutral-600'
                }`}
              >
                {completedIndices.has(i) ? (
                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                ) : i === currentSubhabitIndex ? (
                  <div className="w-3 h-3 rounded-full border-2 border-blue-500 flex-shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-neutral-300 flex-shrink-0" />
                )}
                <span>{sub.title}</span>
                {sub.duration_minutes && (
                  <span className="ml-auto text-neutral-400">{sub.duration_minutes}m</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </ModalWrapper>
    )
  }

  // Normal edit view
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

        {/* Time + Duration on one line */}
        <div className="flex gap-2 mb-1">
          <div className="flex-1">
            <label htmlFor="time" className="block text-xs font-medium text-neutral-700 mb-1">
              Time
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
          <div className="flex-1">
            <label htmlFor="duration" className="block text-xs font-medium text-neutral-700 mb-1">
              Duration (min)
            </label>
            <input
              type="number"
              id="duration"
              value={newDuration}
              onChange={e => setNewDuration(parseInt(e.target.value) || 0)}
              className="w-full px-1 py-1 border border-neutral-300 rounded-md text-xs"
              min="0"
            />
          </div>
        </div>

        {/* Start Routine button */}
        {subhabits.length > 0 && (
          <button
            type="button"
            onClick={startRoutine}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
          >
            <Play className="w-3 h-3" />
            Start Routine ({subhabits.length} steps)
          </button>
        )}

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
