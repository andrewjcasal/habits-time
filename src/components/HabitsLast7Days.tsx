import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
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

interface WeekData {
  weekStart: Date
  weekEnd: Date
  displayWeek: string
  habits: { [habitId: string]: HabitLog[] }
}

const HabitsLast7Days = () => {
  const { user } = useAuth()
  const { habits } = useHabits()
  const [weekData, setWeekData] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)

  const formatTime = (time: string | null) => {
    if (!time) return '-'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatWeekDisplay = (weekStart: Date, weekEnd: Date) => {
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
  }

  const fetchWeeksData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Generate last 4 weeks
      const weeks: WeekData[] = []
      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
        const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
        
        weeks.push({
          weekStart,
          weekEnd,
          displayWeek: formatWeekDisplay(weekStart, weekEnd),
          habits: {},
        })
      }

      // Get all habit logs for the last 4 weeks
      const startDate = format(weeks[0].weekStart, 'yyyy-MM-dd')
      const endDate = format(weeks[weeks.length - 1].weekEnd, 'yyyy-MM-dd')

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

      // Organize logs by week and habit
      weeks.forEach(week => {
        habits.forEach(habit => {
          const weekLogs = logs?.filter(l => {
            const logDate = new Date(l.log_date)
            return l.habits.id === habit.id && 
                   logDate >= week.weekStart && 
                   logDate <= week.weekEnd
          }) || []
          week.habits[habit.id] = weekLogs
        })
      })

      setWeekData(weeks)
    } catch (err) {
      console.error('Error fetching weeks data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeeksData()
  }, [user, habits])

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Loading weeks data...</p>
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
                {weekData.map(week => (
                  <th key={week.weekStart.getTime()} className="px-3 py-3 text-center text-sm font-medium text-gray-900 min-w-[120px]">
                    {week.displayWeek}
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
                  {weekData.map(week => {
                    const weekLogs = week.habits[habit.id] || []
                    const completedDays = weekLogs.filter(log => log.is_completed).length
                    const totalDaysInWeek = Math.ceil((week.weekEnd.getTime() - week.weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                    const completionRate = totalDaysInWeek > 0 ? Math.round((completedDays / totalDaysInWeek) * 100) : 0
                    
                    return (
                      <td key={`${habit.id}-${week.weekStart.getTime()}`} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-lg font-semibold text-gray-900">
                            {completedDays}/{totalDaysInWeek}
                          </div>
                          <div className="text-xs text-gray-600">
                            {completionRate}%
                          </div>
                          <div className="w-12 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
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

      {/* Summary Stats for Current Week */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {habits.map(habit => {
          const currentWeek = weekData[weekData.length - 1] // Last week is current week
          const currentWeekLogs = currentWeek?.habits[habit.id] || []
          const completedDays = currentWeekLogs.filter(log => log.is_completed).length
          const totalDaysInWeek = 7
          const completionRate = Math.round((completedDays / totalDaysInWeek) * 100)
          
          return (
            <div key={habit.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-medium text-gray-900 mb-2">{habit.name}</h3>
              <div className="text-sm text-gray-500 mb-1">Current Week</div>
              <div className="text-2xl font-bold text-blue-600 mb-1">{completedDays}/{totalDaysInWeek}</div>
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