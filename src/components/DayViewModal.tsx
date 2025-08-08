import { useState, useEffect } from 'react'
import { X, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTaskDailyLogs, TaskDailyLog } from '../hooks/useTaskDailyLogs'
import { useAuth } from '../hooks/useAuth'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays, parseISO } from 'date-fns'

interface DayViewModalProps {
  isOpen: boolean
  onClose: () => void
}

type GroupBy = 'day' | 'week'

interface GroupedData {
  [key: string]: TaskDailyLog[]
}

const DayViewModal = ({ isOpen, onClose }: DayViewModalProps) => {
  const { user } = useAuth()
  const { getTaskLogsForDateRange, loading } = useTaskDailyLogs()
  
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [taskLogs, setTaskLogs] = useState<TaskDailyLog[]>([])
  const [groupedData, setGroupedData] = useState<GroupedData>({})

  const fetchData = async () => {
    if (!user) return

    let startDate: Date
    let endDate: Date

    if (groupBy === 'day') {
      startDate = new Date(currentDate)
      endDate = new Date(currentDate)
    } else {
      startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
      endDate = endOfWeek(currentDate, { weekStartsOn: 1 })
    }

    const logs = await getTaskLogsForDateRange(user.id, startDate, endDate)
    if (logs) {
      setTaskLogs(logs)
    }
  }

  const groupTaskLogs = (logs: TaskDailyLog[]) => {
    const grouped: GroupedData = {}
    
    logs.forEach(log => {
      let groupKey: string
      
      if (groupBy === 'day') {
        groupKey = format(parseISO(log.log_date), 'yyyy-MM-dd')
      } else {
        const logDate = parseISO(log.log_date)
        const weekStart = startOfWeek(logDate, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(logDate, { weekStartsOn: 1 })
        groupKey = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = []
      }
      grouped[groupKey].push(log)
    })

    setGroupedData(grouped)
  }

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, groupBy, currentDate, user])

  useEffect(() => {
    groupTaskLogs(taskLogs)
  }, [taskLogs, groupBy])

  const navigatePrevious = () => {
    if (groupBy === 'day') {
      setCurrentDate(prev => subDays(prev, 1))
    } else {
      setCurrentDate(prev => subWeeks(prev, 1))
    }
  }

  const navigateNext = () => {
    if (groupBy === 'day') {
      setCurrentDate(prev => addDays(prev, 1))
    } else {
      setCurrentDate(prev => addWeeks(prev, 1))
    }
  }

  const calculateTotalHours = (logs: TaskDailyLog[]) => {
    return logs.reduce((total, log) => {
      return total + (log.time_spent_hours || log.estimated_hours || 0)
    }, 0)
  }

  const getDisplayTitle = () => {
    if (groupBy === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy')
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">Work Summary</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrevious}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <h3 className="text-lg font-medium text-neutral-800 min-w-[300px] text-center">
              {getDisplayTitle()}
            </h3>
            
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupBy('day')}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                groupBy === 'day'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Day View
            </button>
            <button
              onClick={() => setGroupBy('week')}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                groupBy === 'week'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Week View
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : Object.keys(groupedData).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Calendar className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <h3 className="text-lg font-medium text-neutral-500 mb-2">No work logged</h3>
                <p className="text-sm text-neutral-400">
                  {groupBy === 'day' ? 'No tasks were worked on this day' : 'No tasks were worked on this week'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedData).map(([groupKey, logs]) => (
                <div key={groupKey} className="border border-neutral-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-neutral-800">
                      {groupBy === 'day' ? format(parseISO(groupKey), 'EEEE, MMMM d') : groupKey}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Clock className="w-4 h-4" />
                      <span>{calculateTotalHours(logs).toFixed(1)} hours</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {logs.map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-neutral-800">Task Work</div>
                            {log.completed_at && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                Completed
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-neutral-600 mt-1">
                            {format(parseISO(log.log_date), 'MMM d')} • {log.scheduled_start_time} - {log.scheduled_end_time}
                          </div>
                          {log.notes && (
                            <div className="text-sm text-neutral-500 mt-1">{log.notes}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-neutral-800">
                            {log.time_spent_hours?.toFixed(1) || log.estimated_hours?.toFixed(1) || '0.0'}h
                          </div>
                          {log.time_spent_hours && log.estimated_hours && log.time_spent_hours !== log.estimated_hours && (
                            <div className="text-xs text-neutral-500">
                              Est: {log.estimated_hours.toFixed(1)}h
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DayViewModal