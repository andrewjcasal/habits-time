import React from 'react'
import { format, addDays } from 'date-fns'
import { X } from 'lucide-react'

interface TaskScheduleModalProps {
  showTaskScheduleModal: boolean
  setShowTaskScheduleModal: (show: boolean) => void
  scheduledTasksCache: Map<string, any[]>
  allTasks: any[]
  tasksDailyLogs: any[]
}

export default function TaskScheduleModal({
  showTaskScheduleModal,
  setShowTaskScheduleModal,
  scheduledTasksCache,
  allTasks,
  tasksDailyLogs
}: TaskScheduleModalProps) {
  if (!showTaskScheduleModal) return null

  const today = new Date()
  const sevenDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i)
    const dateKey = format(date, 'yyyy-MM-dd')
    return {
      date,
      dateKey,
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE, MMM d')
    }
  })

  const getTasksForDate = (dateKey: string) => {
    const scheduledTasks = scheduledTasksCache.get(dateKey) || []
    const taskDailyLogs = tasksDailyLogs.filter(log => log.log_date === dateKey)
    
    // Convert tasks_daily_logs to a consistent format
    const normalizedTaskDailyLogs = taskDailyLogs.map(log => {
      // Parse time properly from HH:MM:SS or HH:MM format
      let startTimeInHours = 0
      const timeStr = log.actual_start_time || log.scheduled_start_time
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number)
        startTimeInHours = hours + (minutes / 60)
      }

      // Find the corresponding task from allTasks
      const correspondingTask = allTasks.find(task => task.id === log.task_id)
      
      // Debug logging for task resolution
      if (log.task_id === "6d6353a9-a810-4ad1-82e0-b630f8125c1e") {
        console.log('🐛 Task lookup debug:', {
          taskId: log.task_id,
          correspondingTask: correspondingTask?.title,
          allTasksCount: allTasks.length,
          logNotes: log.notes,
          nestedTaskTitle: log.task?.title
        })
      }
      
      return {
        ...log,
        // Use the task title from the corresponding task, then nested task object, then notes, then fallback
        title: correspondingTask?.title || log.task?.title || log.notes || `Task (${log.task_id?.slice(0, 8)})`,
        // Convert time to decimal hours for consistent sorting
        startTime: startTimeInHours,
        // Use the project from the corresponding task or nested task object
        projects: correspondingTask?.projects || log.task?.projects || log.projects,
        // Mark as daily log for identification
        isDailyLog: true,
        estimated_hours: log.actual_duration || log.scheduled_duration || log.estimated_hours || 0
      }
    })
    
    const allDayTasks = [...scheduledTasks, ...normalizedTaskDailyLogs]
      .sort((a, b) => {
        const aTime = a.startTime || 0
        const bTime = b.startTime || 0
        return aTime - bTime
      })

    return allDayTasks
  }

  const formatTime = (task: any) => {
    let hours24: number
    let minutes: number

    if (task.startTime) {
      hours24 = Math.floor(task.startTime)
      minutes = Math.round((task.startTime - hours24) * 60)
    } else if (task.actual_start_time || task.scheduled_start_time) {
      const timeStr = task.actual_start_time || task.scheduled_start_time
      const [h, m] = timeStr.split(':').map(Number)
      hours24 = h
      minutes = m
    } else {
      return '—'
    }

    // Convert to 12-hour format
    const period = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24
    
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const formatDuration = (task: any) => {
    const duration = task.estimated_hours || task.scheduled_duration || task.actual_duration || 0
    if (duration >= 1) {
      return `${duration.toFixed(1)}h`
    } else {
      return `${Math.round(duration * 60)}m`
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-2 max-w-4xl w-full mx-2 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2 border-b pb-2">
          <h2 className="text-lg font-semibold text-neutral-900">Upcoming Tasks (7 Days)</h2>
          <button
            onClick={() => setShowTaskScheduleModal(false)}
            className="hover:bg-neutral-100 rounded p-1 transition-colors"
          >
            <X className="w-2 h-2 text-neutral-500" />
          </button>
        </div>
        
        <div className="space-y-2">
          {sevenDays.map(({ date, dateKey, label }) => {
            const dayTasks = getTasksForDate(dateKey)
            
            return (
              <div key={dateKey} className="border border-neutral-200 rounded-lg p-2">
                <h3 className="text-sm font-medium text-neutral-900 mb-1 border-b border-neutral-100 pb-1">
                  {label}
                </h3>
                
                {dayTasks.length > 0 ? (
                  <div className="space-y-1">
                    {dayTasks.map((task, index) => {
                      const isPlaceholder = task.isPlaceholder || task.title === 'Billable Work'
                      const isDailyLog = task.isDailyLog
                      const isCompleted = isDailyLog && task.is_completed
                      const projectColor = task.projects?.color || '#6B7280'
                      
                      return (
                        <div key={task.id || index} className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <div 
                              className="w-1 h-1 rounded-full flex-shrink-0"
                              style={{ backgroundColor: projectColor }}
                            />
                            <span className="text-neutral-600 flex-shrink-0 w-16">
                              {formatTime(task)}
                            </span>
                            <span 
                              className={`truncate ${
                                isPlaceholder 
                                  ? 'text-green-600 font-medium' 
                                  : isCompleted 
                                    ? 'text-neutral-500 line-through' 
                                    : 'text-neutral-900'
                              }`}
                              title={task.title}
                            >
                              {task.title}
                            </span>
                            {isCompleted && (
                              <span className="text-green-600 text-xs">✓</span>
                            )}
                            {isDailyLog && !isCompleted && (
                              <span className="text-blue-600 text-xs" title="In progress">●</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {task.projects?.name && (
                              <span className="text-neutral-500 text-xs">
                                {task.projects.name}
                              </span>
                            )}
                            <span className="text-neutral-600 text-xs">
                              {formatDuration(task)}
                            </span>
                            {isPlaceholder && (
                              <span className="text-green-600 text-xs font-medium">
                                ${((task.estimated_hours || 0) * (task.projects?.hourly_rate || 0)).toFixed(0)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500 py-1">
                    No tasks scheduled
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}