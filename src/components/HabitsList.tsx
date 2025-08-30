import { useState } from 'react'
import {
  Clock,
  CheckCircle2,
  Circle,
} from 'lucide-react'

interface HabitsListProps {
  habits: any[]
  selectedDate: string
  selectedHabitId: string | null
  onHabitSelect: (habitId: string) => void
  onToggleCompletion: (habitId: string) => void
  onUpdateTime: (habitId: string, time: string) => void
  onUpdateCompletedTime: (habitId: string, time: string) => void
  getHabitScheduleDisplay: (habit: any, dailyLog: any) => { label: string; time: string }
  formatTime: (time: string) => string
}

const HabitsList = ({
  habits,
  selectedDate,
  selectedHabitId,
  onHabitSelect,
  onToggleCompletion,
  onUpdateTime,
  onUpdateCompletedTime,
  getHabitScheduleDisplay,
  formatTime,
}: HabitsListProps) => {
  const [editingHabit, setEditingHabit] = useState<string | null>(null)
  const [tempTime, setTempTime] = useState('')
  const [editingCompletedTime, setEditingCompletedTime] = useState<string | null>(null)
  const [tempCompletedTime, setTempCompletedTime] = useState('')

  const updateTime = async (habitId: string, newTime: string) => {
    await onUpdateTime(habitId, newTime)
    setEditingHabit(null)
  }

  const updateCompletedTime = async (habitId: string, newTime: string) => {
    await onUpdateCompletedTime(habitId, newTime)
    setEditingCompletedTime(null)
  }

  if (habits.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">No habits for this date.</p>
        <p className="text-xs mt-1">Navigate to other dates or add new habits.</p>
      </div>
    )
  }

  return (
    <>
      {habits.map((habit, index) => {
        const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === selectedDate)
        const isCompleted = dailyLog?.actual_start_time || false
        const isSelected = selectedHabitId === habit.id

        return (
          <div
            key={habit.id}
            onClick={() => onHabitSelect(habit.id)}
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
                    onToggleCompletion(habit.id)
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
                  {/* Only show timing info for calendar habits */}
                  {habit.habits_types?.scheduling_rule !== 'non_calendar' && (
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
                  )}
                </div>
              </div>

              {/* Only show scheduling controls for calendar habits */}
              {habit.habits_types?.scheduling_rule !== 'non_calendar' && (
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
                      {(() => {
                        const { label, time } = getHabitScheduleDisplay(habit, dailyLog)
                        return `${label}: ${formatTime(time)}`
                      })()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default HabitsList