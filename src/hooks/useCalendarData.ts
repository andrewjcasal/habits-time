import { useState, useEffect, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { useHabits } from './useHabits'
import { useSessions } from './useContracts'
import { useProjects } from './useProjects'
import { useSettings } from './useSettings'
import { useMeetings } from './useMeetings'

export const useCalendarData = (windowWidth: number) => {
  const [allTasks, setAllTasks] = useState<any[]>([])
  const [allTasksLoading, setAllTasksLoading] = useState(true)
  const [scheduledTasksCache, setScheduledTasksCache] = useState<Map<string, any[]>>(new Map())
  const [tasksScheduled, setTasksScheduled] = useState(false)
  const [today] = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

  const { habits, loading: habitsLoading } = useHabits()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { projects, loading: projectsLoading } = useProjects()
  const { getWorkHoursRange } = useSettings()
  const { meetings, loading: meetingsLoading } = useMeetings()

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  const getDayColumns = () => {
    if (windowWidth > 850) {
      return Array.from({ length: 5 }, (_, i) => {
        const date = addDays(today, i)
        const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE, MMM d')
        return { date, label }
      })
    } else {
      return [
        { date: today, label: 'Today' },
        { date: addDays(today, 1), label: 'Tomorrow' },
        { date: addDays(today, 2), label: format(addDays(today, 2), 'EEE, MMM d') },
      ]
    }
  }

  const getHourSlots = () => {
    const { end } = getWorkHoursRange()
    const hours = []
    for (let i = 7; i <= end; i++) {
      const hour12 = i > 12 ? i - 12 : i === 0 ? 12 : i
      const ampm = i >= 12 ? 'PM' : 'AM'
      const hourStr = hour12.toString() + ':00 ' + ampm
      const timeValue = i.toString().padStart(2, '0') + ':00'
      hours.push({ display: hourStr, time: timeValue })
    }
    return hours
  }

  const getCurrentTimeLinePosition = (date: Date) => {
    const currentHour = currentTime.getHours()
    const currentMinute = currentTime.getMinutes()
    const { end } = getWorkHoursRange()
    
    if (currentHour < 7 || currentHour >= end) return null
    
    const isToday = format(date, 'yyyy-MM-dd') === format(currentTime, 'yyyy-MM-dd')
    if (!isToday) return null
    
    const hourIndex = currentHour - 7
    const minutePercentage = currentMinute / 60
    const totalPosition = (hourIndex + minutePercentage) * 64
    
    return totalPosition
  }

  // Fetch tasks from all projects without sessions
  useEffect(() => {
    const fetchAllTasks = async () => {
      if (!projectsLoading && projects.length > 0 && !sessionsLoading) {
        setAllTasksLoading(true)

        const projectsWithSessions = new Set(sessions.map(s => s.project_id))
        const projectsWithoutSessions = projects.filter(p => !projectsWithSessions.has(p.id))

        if (projectsWithoutSessions.length === 0) {
          setAllTasks([])
          setAllTasksLoading(false)
          return
        }

        // Fetch tasks for all projects without sessions
        const allTasksPromises = projectsWithoutSessions.map(async project => {
          try {
            const { supabase } = await import('../lib/supabase')
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const { data, error } = await supabase
              .from('tasks')
              .select('*')
              .eq('project_id', project.id)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })

            if (error) {
              console.error('Error fetching tasks for project', project.id, error)
              return []
            }

            return (data || []).map(task => ({ ...task, project: project }))
          } catch (error) {
            console.error('Error fetching tasks:', error)
            return []
          }
        })

        try {
          const allTasksArrays = await Promise.all(allTasksPromises)
          const flattenedTasks = allTasksArrays.flat()
          setAllTasks(flattenedTasks)
        } catch (error) {
          console.error('Error fetching all tasks:', error)
          setAllTasks([])
        }

        setAllTasksLoading(false)
      }
    }

    fetchAllTasks()
  }, [projects, sessions, projectsLoading, sessionsLoading])

  // Get available time blocks for a specific date
  const getAvailableTimeBlocks = (date: Date, alreadyScheduledTasks: any[] = []) => {
    const blocks = []
    const dateStr = format(date, 'yyyy-MM-dd')
    const { start, end } = getWorkHoursRange()

    for (let hour = start; hour < end; hour++) {
      for (let halfHour = 0; halfHour < 2; halfHour++) {
        const minutes = halfHour * 30
        const timeInHours = hour + minutes / 60
        const timeSlot = hour.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0')

        // Check conflicts with habits, sessions, meetings, and already scheduled tasks
        const habitConflicts = habits.filter(habit => {
          // Check if there's a daily log with a scheduled start time for this date
          const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateStr)
          const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
          
          if (!effectiveStartTime) return false
          
          let habitStartHour = parseInt(effectiveStartTime.split(':')[0])
          let habitStartMinute = parseInt(effectiveStartTime.split(':')[1])
          const habitDuration = habit.duration || 0

          // Check for meeting conflicts and rescheduling
          const conflictingMeeting = meetings.find(meeting => {
            const meetingStart = new Date(meeting.start_time)
            const meetingEnd = new Date(meeting.end_time)
            const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')

            if (meetingDateStr !== dateStr) return false

            const habitStartInHours = habitStartHour + habitStartMinute / 60
            const habitEndInHours = habitStartInHours + habitDuration / 60
            const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
            const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60

            return habitStartInHours < meetingEndInHours && habitEndInHours > meetingStartInHours
          })

          if (conflictingMeeting) {
            const meetingEnd = new Date(conflictingMeeting.end_time)
            habitStartHour = meetingEnd.getHours()
            habitStartMinute = meetingEnd.getMinutes() === 0 ? 0 : meetingEnd.getMinutes() <= 30 ? 30 : 0
            if (meetingEnd.getMinutes() > 30) {
              habitStartHour += 1
              habitStartMinute = 0
            }
          }

          const habitStartInHours = habitStartHour + habitStartMinute / 60
          const habitEndInHours = habitStartInHours + habitDuration / 60

          return timeInHours < habitEndInHours && timeInHours + 0.5 > habitStartInHours
        })

        const sessionConflicts = sessions.filter(session => {
          if (!session.actual_start_time || session.scheduled_date !== dateStr) return false
          
          const sessionStartHour = parseInt(session.actual_start_time.split(':')[0])
          const sessionStartMinute = parseInt(session.actual_start_time.split(':')[1])
          const sessionDuration = (session.scheduled_hours || 1) * 60
          
          const sessionStartInHours = sessionStartHour + sessionStartMinute / 60
          const sessionEndInHours = sessionStartInHours + sessionDuration / 60

          return timeInHours < sessionEndInHours && timeInHours + 0.5 > sessionStartInHours
        })

        const meetingConflicts = meetings.filter(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')

          if (meetingDateStr !== dateStr) return false

          const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
          const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60

          return timeInHours < meetingEndInHours && timeInHours + 0.5 > meetingStartInHours
        })

        const scheduledTasksInSlot = alreadyScheduledTasks.filter(
          task => format(task.date, 'yyyy-MM-dd') === dateStr &&
            task.startTime <= timeInHours &&
            timeInHours < task.startTime + task.estimated_hours
        )

        const available = habitConflicts.length === 0 && sessionConflicts.length === 0 && 
                         meetingConflicts.length === 0 && scheduledTasksInSlot.length === 0

        blocks.push({ timeInHours, timeSlot, available })
      }
    }

    return blocks
  }

  // Schedule task in available slots
  const scheduleTaskInAvailableSlots = (taskHours: number, date: Date, taskInfo: any, alreadyScheduledTasks: any[] = []) => {
    const availableBlocks = getAvailableTimeBlocks(date, alreadyScheduledTasks)
    const scheduledChunks = []
    let remainingHours = taskHours

    let currentChunkStart = null
    let currentChunkHours = 0

    for (let i = 0; i < availableBlocks.length && remainingHours > 0; i++) {
      const block = availableBlocks[i]

      if (block.available) {
        if (currentChunkStart === null) {
          currentChunkStart = block.timeInHours
          currentChunkHours = 0
        }
        currentChunkHours += 0.5
      } else {
        if (currentChunkStart !== null && currentChunkHours > 0) {
          const chunkHours = Math.min(currentChunkHours, remainingHours)
          scheduledChunks.push({
            ...taskInfo,
            id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
            title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
            startTime: currentChunkStart,
            startHour: Math.floor(currentChunkStart),
            estimated_hours: chunkHours,
            topPosition: 0,
          })
          remainingHours -= chunkHours
          currentChunkStart = null
          currentChunkHours = 0
        }
      }
    }

    if (currentChunkStart !== null && currentChunkHours > 0 && remainingHours > 0) {
      const chunkHours = Math.min(currentChunkHours, remainingHours)
      scheduledChunks.push({
        ...taskInfo,
        id: `${taskInfo.id}-chunk-${scheduledChunks.length}`,
        title: `${taskInfo.title}${scheduledChunks.length > 0 ? ` (${scheduledChunks.length + 1})` : ''}`,
        startTime: currentChunkStart,
        startHour: Math.floor(currentChunkStart),
        estimated_hours: chunkHours,
        topPosition: 0,
      })
    }

    return scheduledChunks
  }

  // Pre-calculate and cache scheduled tasks
  useEffect(() => {
    if (!allTasksLoading && allTasks.length > 0 && !tasksScheduled && !habitsLoading) {
      const unscheduledTasks = allTasks.filter(
        task => !task.parent_task_id && task.status !== 'completed' && 
                task.estimated_hours && task.estimated_hours > 0
      )

      if (unscheduledTasks.length === 0) {
        setTasksScheduled(true)
        return
      }

      const allDays = getDayColumns()
      let allScheduledChunks: any[] = []
      let remainingTasks = unscheduledTasks.map(task => ({ ...task, remainingHours: task.estimated_hours }))

      for (const dayColumn of allDays) {
        if (remainingTasks.length === 0) break

        let scheduledOnThisDay = true
        while (scheduledOnThisDay && remainingTasks.length > 0) {
          scheduledOnThisDay = false

          for (let i = 0; i < remainingTasks.length; i++) {
            const task = remainingTasks[i]
            const scheduledChunks = scheduleTaskInAvailableSlots(
              task.remainingHours,
              dayColumn.date,
              { ...task, isAutoScheduled: true },
              allScheduledChunks
            )

            if (scheduledChunks.length > 0) {
              const chunksWithDate = scheduledChunks.map(chunk => ({ ...chunk, date: dayColumn.date }))
              allScheduledChunks.push(...chunksWithDate)

              const totalScheduledHours = scheduledChunks.reduce((sum, chunk) => sum + chunk.estimated_hours, 0)
              task.remainingHours -= totalScheduledHours

              if (task.remainingHours <= 0) {
                remainingTasks = remainingTasks.filter(t => t.id !== task.id)
                scheduledOnThisDay = true
              } else {
                scheduledOnThisDay = true
              }
              break
            }
          }
        }
      }

      const tasksByDate = new Map()
      allScheduledChunks.forEach(chunk => {
        const chunkDateKey = format(chunk.date, 'yyyy-MM-dd')
        if (!tasksByDate.has(chunkDateKey)) {
          tasksByDate.set(chunkDateKey, [])
        }
        tasksByDate.get(chunkDateKey).push(chunk)
      })
      setScheduledTasksCache(tasksByDate)
      setTasksScheduled(true)
    }
  }, [allTasks, allTasksLoading, tasksScheduled, habitsLoading])

  // Reset task scheduling when tasks change
  const tasksContentHash = useMemo(() => {
    return allTasks.map(t => `${t.id}-${t.estimated_hours}-${t.status}`).join(',')
  }, [allTasks])

  // Reset task scheduling when habits with daily logs change
  const habitsWithLogsHash = useMemo(() => {
    return habits.map(h => {
      const dailyLogs = h.habits_daily_logs || []
      const logsHash = dailyLogs.map(log => `${log.log_date}-${log.scheduled_start_time}`).join('|')
      return `${h.id}-${h.current_start_time}-${logsHash}`
    }).join(',')
  }, [habits])

  useEffect(() => {
    setTasksScheduled(false)
    setScheduledTasksCache(new Map())
  }, [tasksContentHash, habitsWithLogsHash])

  // Get tasks for a specific time slot
  const getTasksForTimeSlot = (timeSlot: string, date: Date) => {
    if (!tasksScheduled) return []
    
    const dateKey = format(date, 'yyyy-MM-dd')
    const cachedTasks = scheduledTasksCache.get(dateKey) || []
    const currentHour = parseInt(timeSlot.split(':')[0])

    return cachedTasks.filter(chunk => {
      const taskStartHour = chunk.startTime ? Math.floor(chunk.startTime) : chunk.startHour
      return taskStartHour === currentHour
    })
  }

  const dayColumns = useMemo(() => getDayColumns(), [today, windowWidth])
  const hourSlots = useMemo(() => getHourSlots(), [])

  return {
    allTasks,
    allTasksLoading,
    scheduledTasksCache,
    tasksScheduled,
    today,
    currentTime,
    habits,
    habitsLoading,
    sessions,
    sessionsLoading,
    projects,
    projectsLoading,
    meetings,
    meetingsLoading,
    dayColumns,
    hourSlots,
    getCurrentTimeLinePosition,
    getWorkHoursRange,
    getTasksForTimeSlot,
    setAllTasks,
    setAllTasksLoading,
    setScheduledTasksCache,
    setTasksScheduled,
  }
}