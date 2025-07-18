import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHabits } from '../hooks/useHabits'

interface HabitLog {
  log_date: string
  actual_start_time: string | null
  actual_end_time: string | null
  created_at: string
  is_completed: boolean
  habits: {
    id: string
    name: string
    duration: number
  }
}

interface DayData {
  date: string
  displayDate: string
  habits: { [habitId: string]: HabitLog | null }
}

const HabitsLast7Days = () => {
  const { user } = useAuth()
  const { habits } = useHabits()
  const [weekData, setWeekData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  const formatTime = (time: string | null) => {
    if (!time) return '-'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
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
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    }
  }

  const fetchLast7DaysData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Generate last 7 days
      const days: DayData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateString = date.toISOString().split('T')[0]
        
        days.push({
          date: dateString,
          displayDate: formatDateDisplay(dateString),
          habits: {},
        })
      }

      // Get all habit logs for the last 7 days
      const startDate = days[0].date
      const endDate = days[days.length - 1].date

      const { data: logs, error } = await supabase
        .from('habits_daily_logs')
        .select(`
          log_date,
          actual_start_time,
          actual_end_time,
          created_at,
          is_completed,
          habits!inner (
            id,
            name,
            duration
          )
        `)
        .eq('user_id', user.id)
        .gte('log_date', startDate)
        .lte('log_date', endDate)
        .order('log_date', { ascending: true })

      if (error) throw error

      // Organize logs by date and habit
      days.forEach(day => {
        habits.forEach(habit => {
          const log = logs?.find(l => 
            l.log_date === day.date && l.habits.id === habit.id
          )
          day.habits[habit.id] = log || null
        })
      })

      setWeekData(days)
    } catch (err) {
      console.error('Error fetching last 7 days data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLast7DaysData()
  }, [user, habits])

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Loading last 7 days data...</p>
      </div>
    )
  }

  if (habits.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No habits found. Create some habits to see your progress!</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 sticky left-0 bg-gray-50 z-10">
                  Habit
                </th>
                {weekData.map(day => (
                  <th key={day.date} className="px-3 py-3 text-center text-sm font-medium text-gray-900 min-w-[120px]">
                    {day.displayDate}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {habits.map(habit => (
                <tr key={habit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                    <div>
                      <div className="font-medium">{habit.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {habit.duration}m
                      </div>
                    </div>
                  </td>
                  {weekData.map(day => {
                    const log = day.habits[habit.id]
                    const isCompleted = log?.is_completed || false
                    
                    return (
                      <td key={`${habit.id}-${day.date}`} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300" />
                            )}
                          </div>
                          {log?.actual_start_time && (
                            <div className="text-xs text-gray-600">
                              {formatTime(log.actual_start_time)}
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {habits.map(habit => {
          const completedDays = weekData.filter(day => day.habits[habit.id]?.is_completed).length
          const completionRate = Math.round((completedDays / 7) * 100)
          
          return (
            <div key={habit.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">{habit.name}</h3>
              <div className="text-2xl font-bold text-blue-600 mb-1">{completedDays}/7</div>
              <div className="text-sm text-gray-500">
                {completionRate}% completion rate
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HabitsLast7Days