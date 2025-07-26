import { useState, useEffect } from 'react'
import {
  Clock,
  CheckCircle2,
  Circle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useHabits } from '../hooks/useHabits'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import HabitDetailTabs from '../components/HabitDetailTabs'
import LoadingSpinner from '../components/LoadingSpinner'
import CreateHabitModal from '../components/CreateHabitModal'
import HabitsTopbar from '../components/HabitsTopbar'
import HabitsLast7Days from '../components/HabitsLast7Days'

const Habits = () => {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const {
    habits,
    loading,
    error,
    logHabitCompletion,
    updateHabitStartTime,
    updateHabitStartTimes,
    createHabit,
    getNextHabit,
  } = useHabits(selectedDate)

  const [editingHabit, setEditingHabit] = useState<string | null>(null)
  const [tempTime, setTempTime] = useState('')
  const [editingCompletedTime, setEditingCompletedTime] = useState<string | null>(null)
  const [tempCompletedTime, setTempCompletedTime] = useState('')
  const [routineLogs, setRoutineLogs] = useState<any[]>([])
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'today' | 'last7days'>('today')

  const toggleCompletion = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId)
    const currentLog = habit?.habits_daily_logs?.[0]
    const newCompletionState = !currentLog?.is_completed

    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

    await logHabitCompletion(
      habitId,
      newCompletionState,
      newCompletionState ? currentTime : undefined,
      newCompletionState ? currentTime : undefined
    )
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate)
    if (direction === 'prev') {
      current.setDate(current.getDate() - 1)
    } else {
      current.setDate(current.getDate() + 1)
    }
    setSelectedDate(current.toISOString().split('T')[0])
  }

  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const todayString = today.toISOString().split('T')[0]
    const yesterdayString = yesterday.toISOString().split('T')[0]

    if (dateString === todayString) {
      return 'Today'
    } else if (dateString === yesterdayString) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    }
  }

  const updateTime = async (habitId: string, newTime: string) => {
    await updateHabitStartTime(habitId, newTime)
    setEditingHabit(null)
  }

  const updateCompletedTime = async (habitId: string, newTime: string) => {
    const habit = habits.find(h => h.id === habitId)
    const currentLog = habit?.habits_daily_logs?.[0]

    if (currentLog?.is_completed) {
      await logHabitCompletion(
        habitId,
        true,
        newTime,
        newTime // Using same time for start and end - you might want to calculate end time based on duration
      )
    }
    setEditingCompletedTime(null)
  }

  const formatTime = (time: string | null) => {
    if (!time) return '9:00 AM'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const fetchRoutineLogs = async () => {
    if (!user) return

    try {
      // Get sleep logs to determine day boundaries
      const { data: sleepLogs, error: sleepError } = await supabase
        .from('habits_time_logs')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('activity_type_id', '951bc26a-a863-4996-8a02-f4da2d148aa9')
        .order('start_time', { ascending: false })
        .limit(10)

      if (sleepError) throw sleepError

      // Get routine logs from the last 14 days to account for sleep boundaries
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 14)
      const endDate = new Date()

      const { data, error } = await supabase
        .from('habits_daily_logs')
        .select(
          `
          log_date,
          actual_start_time,
          actual_end_time,
          created_at,
          habits!inner (
            id,
            name
          )
        `
        )
        .eq('user_id', user.id)
        .gte('log_date', startDate.toISOString().split('T')[0])
        .lte('log_date', endDate.toISOString().split('T')[0])
        .in('habits.id', [
          'ad94f045-1f1f-49c6-aef1-578d0013cf9e',
          '0edf2ca9-b14f-451f-9043-e13cb8daf684',
        ])
        .order('log_date', { ascending: false })

      if (error) throw error

      // Group logs by sleep cycles instead of calendar days
      const groupedLogs = []
      const sleepBoundaries = sleepLogs?.map(log => new Date(log.start_time)) || []

      for (let i = 0; i < 7; i++) {
        const currentSleep = sleepBoundaries[i]
        const previousSleep = sleepBoundaries[i + 1]

        if (!currentSleep) continue

        // Find logs that occurred between previous sleep and current sleep
        const dayLogs =
          data?.filter(log => {
            const logDateTime = new Date(log.created_at)

            // Must be before current sleep
            if (logDateTime >= currentSleep) return false

            // If there's a previous sleep, must be after that sleep
            if (previousSleep && logDateTime < previousSleep) return false

            return true
          }) || []

        // Use the day before sleep as the display date
        const displayDate = new Date(currentSleep)
        displayDate.setDate(displayDate.getDate() - 1)

        groupedLogs.push({
          sleepDate: currentSleep.toISOString().split('T')[0],
          sleepTime: currentSleep,
          displayDate: displayDate,
          logs: dayLogs,
        })
      }

      setRoutineLogs(groupedLogs)
    } catch (err) {
      console.error('Error fetching routine logs:', err)
    }
  }

  useEffect(() => {
    fetchRoutineLogs()
  }, [user])

  useEffect(() => {
    console.log('abc')
    // Auto-select the next habit when habits load
    if (habits.length > 0 && !selectedHabitId) {
      console.log('abc 123')
      const nextHabit = getNextHabit()
      console.log('abc next', nextHabit)
      setSelectedHabitId(nextHabit?.id || null)
    }
  }, [habits, selectedHabitId])

  if (loading) {
    return <LoadingSpinner message="Loading habits..." />
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading habits: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <HabitsTopbar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {activeTab === 'today' ? (
        <div
          className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0"
          style={{ minHeight: 'calc(100vh - 200px)' }}
        >
        {/* Habits List - Outlook style */}
        <div className="border-r border-gray-200 flex flex-col">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateDate('prev')}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <h2 className="text-sm font-semibold text-gray-900">
                {formatDateDisplay(selectedDate)}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateDate('next')}
                  className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Add new habit"
                >
                  <Plus className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {habits.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">No habits for this date.</p>
                <p className="text-xs mt-1">Navigate to other dates or add new habits.</p>
              </div>
            ) : (
              habits.map((habit, index) => {
                const dailyLog = habit.habits_daily_logs?.[0]
                const isCompleted = dailyLog?.actual_start_time || false
                const isSelected = selectedHabitId === habit.id

                return (
                  <div
                    key={habit.id}
                    onClick={() => setSelectedHabitId(habit.id)}
                    className={`border-b border-gray-200 px-2 py-1 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-yellow-100'
                        : isCompleted
                        ? 'bg-green-50 hover:bg-green-100'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            toggleCompletion(habit.id)
                          }}
                          className="flex-shrink-0"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <Circle className="w-3 h-3 text-neutral-400 hover:text-neutral-600" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <h3
                            className={`font-medium text-sm ${
                              isCompleted ? 'text-green-800' : 'text-neutral-900'
                            }`}
                          >
                            {habit.name}
                          </h3>
                          <div className="flex items-center space-x-1 text-xs text-neutral-600">
                            <Clock className="w-2 h-2" />
                            <span>{habit.duration}m</span>
                            {dailyLog?.actual_start_time &&
                              dailyLog?.actual_end_time &&
                              (editingCompletedTime === habit.id ? (
                                <div
                                  className="flex items-center space-x-1"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <span className="text-green-600">•</span>
                                  <input
                                    type="time"
                                    value={tempCompletedTime}
                                    onChange={e => setTempCompletedTime(e.target.value)}
                                    className="px-1 py-0.5 border border-primary-500 rounded text-xs w-16 bg-white"
                                    autoFocus
                                    onBlur={() => updateCompletedTime(habit.id, tempCompletedTime)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        updateCompletedTime(habit.id, tempCompletedTime)
                                      } else if (e.key === 'Escape') {
                                        setEditingCompletedTime(null)
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <span
                                  className="text-green-600 cursor-pointer hover:bg-green-100 px-1 py-0.5 rounded transition-colors"
                                  onClick={e => {
                                    e.stopPropagation()
                                    setEditingCompletedTime(habit.id)
                                    setTempCompletedTime(dailyLog.actual_start_time)
                                  }}
                                  title="Click to edit completed time"
                                >
                                  • {formatTime(dailyLog.actual_start_time)}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center">
                        {editingHabit === habit.id ? (
                          <div
                            className="flex items-center space-x-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="time"
                              value={tempTime}
                              onChange={e => setTempTime(e.target.value)}
                              className="px-1 py-0.5 border border-neutral-300 rounded text-xs w-16"
                              autoFocus
                            />
                            <button
                              onClick={() => updateTime(habit.id, tempTime)}
                              className="px-1.5 py-0.5 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingHabit(null)}
                              className="px-1.5 py-0.5 border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-neutral-600">
                            Next: {formatTime(habit.current_start_time)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
        {/* Detail Panel - Show only selected habit */}
        <div className="bg-white col-span-2">
          {selectedHabitId &&
            (() => {
              const selectedHabit = habits.find(h => h.id === selectedHabitId)
              return selectedHabit ? (
                <HabitDetailTabs
                  key={`detail-${selectedHabit.id}`}
                  habitId={selectedHabit.id}
                  habitName={selectedHabit.name}
                  initialContext={{
                    background: selectedHabit.background || '',
                    benefits: selectedHabit.benefits || '',
                    consequences: selectedHabit.consequences || '',
                  }}
                  onHabitDeleted={() => setSelectedHabitId(null)}
                />
              ) : null
            })()}
        </div>
        </div>
      ) : (
        <HabitsLast7Days />
      )}

      <CreateHabitModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateHabit={createHabit}
      />
    </div>
  )
}

export default Habits
