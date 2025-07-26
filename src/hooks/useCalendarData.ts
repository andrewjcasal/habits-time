import { useState, useEffect, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { useHabits } from './useHabits'
import { useSessions } from './useContracts'
import { useProjects } from './useProjects'
import { useSettings } from './useSettings'
import { useMeetings } from './useMeetings'

export const useCalendarData = (windowWidth: number, baseDate: Date = new Date()) => {
  const [allTasks, setAllTasks] = useState<any[]>([])
  const [allTasksLoading, setAllTasksLoading] = useState(true)
  const [scheduledTasksCache, setScheduledTasksCache] = useState<Map<string, any[]>>(new Map())
  const [tasksScheduled, setTasksScheduled] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits()
  const { sessions, loading: sessionsLoading } = useSessions()
  const { projects, loading: projectsLoading } = useProjects()
  const { getWorkHoursRange } = useSettings()
  const { meetings, loading: meetingsLoading, addMeeting, updateMeeting, deleteMeeting } = useMeetings()

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date())
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Memoize day columns calculation to avoid repeated date operations
  const dayColumns = useMemo(() => {
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd')
    
    const columnCount = windowWidth > 600 ? 7 : 3
    
    return Array.from({ length: columnCount }, (_, i) => {
      const date = addDays(baseDate, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      
      let label: string
      if (dateStr === todayStr) {
        label = 'Today'
      } else if (dateStr === tomorrowStr) {
        label = 'Tomorrow'
      } else {
        label = format(date, 'EEE, MMM d')
      }
      
      return { date, label, dateStr }
    })
  }, [baseDate, windowWidth])

  // Pre-compute conflict maps for O(1) lookups - only when data is stable
  const conflictMaps = useMemo(() => {
    if (habitsLoading || sessionsLoading || meetingsLoading) {
      return { habitConflicts: new Map(), sessionConflicts: new Map(), meetingConflicts: new Map() }
    }
    const habitConflicts = new Map()
    const sessionConflicts = new Map()
    const meetingConflicts = new Map()
    
    // Pre-compute habit conflicts for each date and time slot
    habits.forEach(habit => {
      dayColumns.forEach(({ dateStr }) => {
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateStr)
        const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
        
        if (effectiveStartTime) {
          const [hours, minutes] = effectiveStartTime.split(':').map(Number)
          const startTimeInHours = hours + minutes / 60
          const duration = dailyLog?.duration || habit.duration || 0
          const endTimeInHours = startTimeInHours + duration / 60
          
          // Check for meeting conflicts and adjust habit time
          let adjustedStartTime = startTimeInHours
          const conflictingMeeting = meetings.find(meeting => {
            const meetingStart = new Date(meeting.start_time)
            const meetingEnd = new Date(meeting.end_time)
            const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')
            
            if (meetingDateStr !== dateStr) return false
            
            const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
            const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
            
            return startTimeInHours < meetingEndInHours && endTimeInHours > meetingStartInHours
          })
          
          if (conflictingMeeting) {
            const meetingEnd = new Date(conflictingMeeting.end_time)
            adjustedStartTime = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
          }
          
          const adjustedEndTime = adjustedStartTime + duration / 60
          
          // Mark all affected time slots in 15-minute increments
          for (let time = Math.floor(adjustedStartTime * 4) / 4; time < adjustedEndTime; time += 0.25) {
            const key = `${dateStr}-${time}`
            habitConflicts.set(key, habit)
          }
        }
      })
    })
    
    // Pre-compute session conflicts
    sessions.forEach(session => {
      if (session.actual_start_time && session.scheduled_date) {
        // Handle timezone-aware time formats like "13:00:00+00" or "13:00:00-05"
        const timeOnly = session.actual_start_time.split(/[+-]/)[0] // Remove timezone part
        const [hours, minutes] = timeOnly.split(':').map(Number)
        const startTimeInHours = hours + minutes / 60
        const duration = session.session_duration || 2 // Default to 2 hours based on your data
        const endTimeInHours = startTimeInHours + duration
        
        for (let time = Math.floor(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
          const key = `${session.scheduled_date}-${time}`
          sessionConflicts.set(key, session)
        }
      }
    })
    
    // Pre-compute meeting conflicts
    meetings.forEach(meeting => {
      const meetingStart = new Date(meeting.start_time)
      const meetingEnd = new Date(meeting.end_time)
      const dateStr = format(meetingStart, 'yyyy-MM-dd')
      
      const startTimeInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
      const endTimeInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
      
      for (let time = Math.floor(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
        const key = `${dateStr}-${time}`
        meetingConflicts.set(key, meeting)
      }
    })
    
    return { habitConflicts, sessionConflicts, meetingConflicts }
  }, [habits, sessions, meetings, dayColumns, habitsLoading, sessionsLoading, meetingsLoading])

  const getDayColumns = () => {
    return dayColumns
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

        // Batch fetch all tasks in a single query (much faster)
        try {
          const { supabase } = await import('../lib/supabase')
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (!user) {
            setAllTasks([])
            setAllTasksLoading(false)
            return
          }

          const projectIds = projectsWithoutSessions.map(p => p.id)
          const { data, error } = await supabase
            .from('tasks')
            .select(`
              *,
              projects!inner(*)
            `)
            .in('project_id', projectIds)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (error) {
            console.error('Error fetching tasks:', error)
            setAllTasks([])
          } else {
            // Map project data to tasks
            const tasksWithProjects = (data || []).map(task => ({
              ...task,
              project: task.projects
            }))
            setAllTasks(tasksWithProjects)
          }
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
      for (let quarterHour = 0; quarterHour < 4; quarterHour++) {
        const minutes = quarterHour * 15
        const timeInHours = hour + minutes / 60
        const timeSlot =
          hour.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0')

        // Use pre-computed conflict maps for O(1) lookups instead of O(n²) filtering
        const conflictKey = `${dateStr}-${timeInHours}`
        const habitConflict = conflictMaps.habitConflicts.get(conflictKey)
        const sessionConflict = conflictMaps.sessionConflicts.get(conflictKey)
        const meetingConflict = conflictMaps.meetingConflicts.get(conflictKey)
        
        // Keep existing complex logic but make it much faster
        const habitConflicts = habitConflict ? [habitConflict] : []
        const sessionConflicts = sessionConflict ? [sessionConflict] : []
        const meetingConflicts = meetingConflict ? [meetingConflict] : []
        
        // Remove the old complex filtering and replace with:
        /*const habitConflicts = habits.filter(habit => {
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
            habitStartMinute =
              meetingEnd.getMinutes() === 0 ? 0 : meetingEnd.getMinutes() <= 30 ? 30 : 0
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
        })*/

        const scheduledTasksInSlot = alreadyScheduledTasks.filter(
          task =>
            format(task.date, 'yyyy-MM-dd') === dateStr &&
            task.startTime <= timeInHours &&
            timeInHours < task.startTime + task.estimated_hours
        )

        const available =
          habitConflicts.length === 0 &&
          sessionConflicts.length === 0 &&
          meetingConflicts.length === 0 &&
          scheduledTasksInSlot.length === 0

        blocks.push({ timeInHours, timeSlot, available })
      }
    }

    return blocks
  }

  // Schedule task in available slots
  const scheduleTaskInAvailableSlots = (
    taskHours: number,
    date: Date,
    taskInfo: any,
    alreadyScheduledTasks: any[] = []
  ) => {
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
        currentChunkHours += 0.25
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

  // Pre-calculate and cache scheduled tasks with race condition protection
  useEffect(() => {
    if (!allTasksLoading && allTasks.length > 0 && !tasksScheduled && !habitsLoading && !projectsLoading && !sessionsLoading) {
      const unscheduledTasks = allTasks.filter(
        task =>
          !task.parent_task_id &&
          task.status !== 'completed' &&
          task.estimated_hours &&
          task.estimated_hours > 0
      )

      if (unscheduledTasks.length === 0) {
        setTasksScheduled(true)
        return
      }

      const allDays = getDayColumns()
      let allScheduledChunks: any[] = []
      let remainingTasks = unscheduledTasks.map(task => ({
        ...task,
        remainingHours: task.estimated_hours,
      }))

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
              const chunksWithDate = scheduledChunks.map(chunk => ({
                ...chunk,
                date: dayColumn.date,
              }))
              allScheduledChunks.push(...chunksWithDate)

              const totalScheduledHours = scheduledChunks.reduce(
                (sum, chunk) => sum + chunk.estimated_hours,
                0
              )
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
  }, [allTasks, allTasksLoading, tasksScheduled, habitsLoading, projectsLoading, sessionsLoading])

  // Debounced reset to prevent rapid re-scheduling
  const tasksContentHash = useMemo(() => {
    return allTasks.map(t => `${t.id}-${t.estimated_hours}-${t.status}`).join(',')
  }, [allTasks])

  const habitsWithLogsHash = useMemo(() => {
    return habits
      .map(h => {
        const dailyLogs = h.habits_daily_logs || []
        const logsHash = dailyLogs
          .map(log => `${log.log_date}-${log.scheduled_start_time}`)
          .join('|')
        return `${h.id}-${h.current_start_time}-${logsHash}`
      })
      .join(',')
  }, [habits])

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    
    const debouncedReset = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setTasksScheduled(false)
        setScheduledTasksCache(new Map())
      }, 100)
    }
    
    debouncedReset()
    
    return () => clearTimeout(timeoutId)
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

  const hourSlots = useMemo(() => getHourSlots(), [])

  return {
    allTasks,
    allTasksLoading,
    scheduledTasksCache,
    tasksScheduled,
    baseDate,
    currentTime,
    habits,
    habitsLoading,
    refetchHabits,
    conflictMaps,
    sessions,
    sessionsLoading,
    projects,
    projectsLoading,
    meetings,
    meetingsLoading,
    addMeeting,
    updateMeeting,
    deleteMeeting,
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
