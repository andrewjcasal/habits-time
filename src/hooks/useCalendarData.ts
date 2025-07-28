import { useState, useEffect, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { useSettings } from './useSettings'
import { useTaskDailyLogs } from './useTaskDailyLogs'
import { supabase } from '../lib/supabase'
import { fetchAllCalendarData, fetchTasksForProjects } from '../utils/calendarDataFetcher'
import { computeConflictMaps } from '../utils/calendarConflicts'
import { scheduleAllTasks, scheduleTaskInAvailableSlots } from '../utils/taskScheduling'
import { addMeeting as addMeetingUtil, updateMeeting as updateMeetingUtil, deleteMeeting as deleteMeetingUtil } from '../utils/meetingManager'

export const useCalendarData = (windowWidth: number, baseDate: Date = new Date()) => {
  const [allTasks, setAllTasks] = useState<any[]>([])
  const [habits, setHabits] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [tasksDailyLogs, setTasksDailyLogs] = useState<any[]>([])
  const [scheduledTasksCache, setScheduledTasksCache] = useState<Map<string, any[]>>(new Map())
  const [tasksScheduled, setTasksScheduled] = useState(false)
  
  const [dataHash, setDataHash] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [conflictMaps, setConflictMaps] = useState({ 
    habitConflicts: new Map(), 
    sessionConflicts: new Map(), 
    meetingConflicts: new Map(),
    tasksDailyLogsConflicts: new Map()
  })

  const { settings, getWorkHoursRange } = useSettings()
  const { saveTaskChunks, clearTaskLogsForDate } = useTaskDailyLogs()

  // Don't reset on date changes - keep cached tasks

  // Create data hash to detect when regeneration is needed
  const createDataHash = (habits: any[], sessions: any[], meetings: any[], tasks: any[], tasksDailyLogs: any[]) => {
    return [
      habits.map(h => `${h.id}-${h.current_start_time}-${h.duration}`).join('|'),
      sessions.map(s => `${s.id}-${s.scheduled_date}-${s.actual_start_time}-${s.scheduled_hours}`).join('|'),
      meetings.map(m => `${m.id}-${m.start_time}-${m.end_time}`).join('|'),
      tasks.map(t => `${t.id}-${t.estimated_hours}-${t.status}`).join('|'),
      tasksDailyLogs.map(l => `${l.id}-${l.log_date}-${l.scheduled_start_time}`).join('|')
    ].join('::')
  }

  // Load data once and cache tasks intelligently
  useEffect(() => {
    const loadAndProcessAllCalendarData = async () => {
      
      setIsDataLoading(true)
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsDataLoading(false)
          return
        }

        // Step 1: Fetch all base data in parallel and update UI immediately
        const dataPromise = fetchAllCalendarData(user.id)
        const { habits: fetchedHabits, sessions: fetchedSessions, projects: fetchedProjects, meetings: fetchedMeetings, tasksDailyLogs: fetchedTasksDailyLogs, settings: fetchedSettings } = await dataPromise

        // Step 2: Update UI immediately with base data (shows habits, sessions, meetings)
        setHabits(fetchedHabits)
        setSessions(fetchedSessions)
        setProjects(fetchedProjects)
        setMeetings(fetchedMeetings)
        setTasksDailyLogs(fetchedTasksDailyLogs)
        setIsDataLoading(false) // Show partial data immediately
        
        

        // Create work hours range function using fetched settings
        const getWorkHoursRangeFromSettings = () => {
          if (!fetchedSettings) {
            console.warn('⚠️ No settings found, using fallback work hours (10-22)')
            return { start: 10, end: 22 }
          }
          
          const start = parseInt(fetchedSettings.work_hours_start.split(':')[0], 10)
          const end = parseInt(fetchedSettings.work_hours_end.split(':')[0], 10)
          
          
          return { start, end }
        }

        // Step 3: Fetch and process tasks in background
        const tasksPromise = fetchTasksForProjects(user.id, fetchedProjects, fetchedSessions)
        
        // Step 4: Process conflict maps while tasks are loading
        const today = new Date()
        const todayStr = format(today, 'yyyy-MM-dd')
        const filteredTasksDailyLogs = fetchedTasksDailyLogs.filter(log => log.log_date !== todayStr)
        const dayColumnsList = getDayColumns()
        const newConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList, filteredTasksDailyLogs)
        setConflictMaps(newConflictMaps)

        // Step 5: Wait for tasks and schedule them
        const fetchedTasks = await tasksPromise
        setAllTasks(fetchedTasks)

        // Step 6: Check if we need to regenerate tasks
        const newDataHash = createDataHash(fetchedHabits, fetchedSessions, fetchedMeetings, fetchedTasks, fetchedTasksDailyLogs)
        const needsRegeneration = !tasksScheduled || dataHash !== newDataHash

        if (needsRegeneration) {
          
          setDataHash(newDataHash)

          // Clear today's task logs only when regenerating
          await clearTaskLogsForDate(user.id, today)

          try {
            // Schedule tasks - use filtered data consistent with conflict computation
            const scheduledTasksResult = await scheduleAllTasks(
              fetchedTasks,
              newConflictMaps,
              dayColumnsList,
              getWorkHoursRangeFromSettings,
              scheduleTaskInAvailableSlots,
              saveTaskChunks,
              clearTaskLogsForDate,
              user.id,
              filteredTasksDailyLogs,
              fetchedSettings?.weekend_days || ['saturday', 'sunday']
            )
            setScheduledTasksCache(scheduledTasksResult)
            setTasksScheduled(true)

          } catch (error) {
            console.error('❌ Task scheduling failed:', error)
            // Set tasksScheduled to true even if scheduling fails to prevent infinite loading
            // This ensures the UI shows whatever tasks are available
            setTasksScheduled(true)
          }
        } else {
          // Ensure tasksScheduled is true when using cached data
          setTasksScheduled(true)
        }
        
      } catch (error) {
        console.error('Error in calendar data loading:', error)
        setIsDataLoading(false)
        // Set tasksScheduled to true to prevent infinite loading state
        setTasksScheduled(true)
      }
    }

    // Only load if not already scheduled, or if explicitly reset
    if (!tasksScheduled) {
      loadAndProcessAllCalendarData()
    }
  }, [tasksScheduled]) // Re-run when tasksScheduled changes

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

  // Meeting management functions
  const addMeeting = async (meetingData: any) => {
    const data = await addMeetingUtil(meetingData)
    setMeetings(prev => [...prev, data])
    return data
  }

  const updateMeeting = async (id: string, meetingData: any) => {
    const data = await updateMeetingUtil(id, meetingData)
    setMeetings(prev => prev.map(m => m.id === id ? data : m))
    return data
  }

  const deleteMeeting = async (id: string) => {
    await deleteMeetingUtil(id)
    setMeetings(prev => prev.filter(m => m.id !== id))
  }



  // Trigger regeneration when data changes
  useEffect(() => {
    if (!tasksScheduled || !dataHash) return // Don't trigger on initial load
    
    const newDataHash = createDataHash(habits, sessions, meetings, allTasks, tasksDailyLogs)
    if (dataHash !== newDataHash) {
      
      
      // Trigger immediate regeneration
      const regenerateTasks = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          setDataHash(newDataHash)
          
          // Clear today's task logs and regenerate
          const today = new Date()
          await clearTaskLogsForDate(user.id, today)
          
          // Filter out today's task logs for conflict computation
          const todayStr = format(today, 'yyyy-MM-dd')
          const filteredTasksDailyLogs = tasksDailyLogs.filter(log => log.log_date !== todayStr)
          
          // Recompute conflicts with new data
          const newConflictMaps = computeConflictMaps(habits, sessions, meetings, dayColumns, filteredTasksDailyLogs)
          setConflictMaps(newConflictMaps)

          try {
            // Schedule tasks with new conflicts - use filtered data consistent with clearing
            const scheduledTasksResult = await scheduleAllTasks(
              allTasks,
              newConflictMaps,
              dayColumns,
              getWorkHoursRange,
              scheduleTaskInAvailableSlots,
              saveTaskChunks,
              clearTaskLogsForDate,
              user.id,
              filteredTasksDailyLogs,
              settings?.weekend_days || ['saturday', 'sunday']
            )
            setScheduledTasksCache(scheduledTasksResult)
            
          } catch (error) {
            console.error('❌ Task regeneration failed:', error)
            // Continue with existing cache to avoid breaking the UI
          }
          
        } catch (error) {
          console.error('Error regenerating tasks:', error)
        }
      }
      
      regenerateTasks()
    }
  }, [habits, sessions, meetings, allTasks, tasksDailyLogs, dataHash, tasksScheduled, dayColumns, getWorkHoursRange, saveTaskChunks, clearTaskLogsForDate])

  // Get tasks for a specific time slot
  const getTasksForTimeSlot = (timeSlot: string, date: Date) => {
    if (!tasksScheduled) {
      return []
    }

    const dateKey = format(date, 'yyyy-MM-dd')
    const cachedTasks = scheduledTasksCache.get(dateKey) || []
    const currentHour = parseInt(timeSlot.split(':')[0])
    
    const filteredTasks = cachedTasks.filter(chunk => {
      const taskStartHour = chunk.startTime ? Math.floor(chunk.startTime) : chunk.startHour
      return taskStartHour === currentHour
    })

    return filteredTasks
  }

  // Get meetings for a specific time slot
  const getMeetingsForTimeSlot = (timeSlot: string, date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const currentHour = parseInt(timeSlot.split(':')[0])

    return meetings.filter(meeting => {
      const meetingStart = new Date(meeting.start_time)
      const meetingDate = format(meetingStart, 'yyyy-MM-dd')
      const meetingHour = meetingStart.getHours()

      return meetingDate === dateKey && meetingHour === currentHour
    })
  }

  // Get habits for a specific time slot
  const getHabitsForTimeSlot = (timeSlot: string, date: Date) => {
    const currentHour = parseInt(timeSlot.split(':')[0])
    const dateKey = format(date, 'yyyy-MM-dd')

    return habits
      .filter(habit => {
        // Only show habits that existed on this date
        if (habit.created_at) {
          const habitCreationDate = new Date(habit.created_at).toISOString().split('T')[0]
          if (dateKey < habitCreationDate) return false
        }
        
        // Check if there's a daily log with a scheduled start time for this date
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateKey)
        
        // Skip habit if it's marked as skipped for this date
        if (dailyLog?.is_skipped) return false
        
        const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
        const effectiveDuration = dailyLog?.duration || habit.duration || 0

        if (!effectiveStartTime) return false

        const habitStartHour = parseInt(effectiveStartTime.split(':')[0])
        const habitStartMinute = parseInt(effectiveStartTime.split(':')[1])

        // Check for meeting conflicts and rescheduling
        const conflictingMeeting = meetings.find(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')

          if (meetingDateStr !== dateKey) return false

          const habitDuration = effectiveDuration
          const habitStartInHours = habitStartHour + habitStartMinute / 60
          const habitEndInHours = habitStartInHours + habitDuration / 60
          const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
          const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60

          return habitStartInHours < meetingEndInHours && habitEndInHours > meetingStartInHours
        })

        // Check for session conflicts and rescheduling
        const conflictingSession = sessions.find(session => {
          if (!session.actual_start_time || session.scheduled_date !== dateKey) return false

          const sessionStartHour = parseInt(session.actual_start_time.split(':')[0])
          const sessionStartMinute = parseInt(session.actual_start_time.split(':')[1])
          const sessionDuration = (session.scheduled_hours || 1) * 60 // Duration in minutes

          const habitDuration = effectiveDuration
          const habitStartInHours = habitStartHour + habitStartMinute / 60
          const habitEndInHours = habitStartInHours + habitDuration / 60
          const sessionStartInHours = sessionStartHour + sessionStartMinute / 60
          const sessionEndInHours = sessionStartInHours + sessionDuration / 60

          return habitStartInHours < sessionEndInHours && habitEndInHours > sessionStartInHours
        })

        if (conflictingMeeting) {
          const meetingEnd = new Date(conflictingMeeting.end_time)
          const newStartHour = meetingEnd.getHours() + (meetingEnd.getMinutes() > 30 ? 1 : 0)
          return newStartHour === currentHour
        }

        if (conflictingSession) {
          const sessionStartHour = parseInt(conflictingSession.actual_start_time!.split(':')[0])
          const sessionStartMinute = parseInt(conflictingSession.actual_start_time!.split(':')[1])
          const sessionDuration = (conflictingSession.scheduled_hours || 1) * 60 // Duration in minutes
          const sessionEndMinute = sessionStartMinute + sessionDuration
          const sessionEndHour = sessionStartHour + Math.floor(sessionEndMinute / 60)
          const finalEndMinute = sessionEndMinute % 60

          const newStartHour = sessionEndHour + (finalEndMinute > 30 ? 1 : 0)
          return newStartHour === currentHour
        }

        // Check if habit starts within this hour slot (handles 30-minute start times like 9:30)
        const shouldShow = habitStartHour === currentHour
        return shouldShow
      })
      .map(habit => {
        // Use the same effective start time and duration logic as in the filter
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateKey)
        const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
        const effectiveDuration = dailyLog?.duration || habit.duration || 0

        const habitStartHour = parseInt(effectiveStartTime!.split(':')[0])
        const habitStartMinute = parseInt(effectiveStartTime!.split(':')[1])

        // Check for rescheduling (meetings first, then sessions)
        const conflictingMeeting = meetings.find(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')

          if (meetingDateStr !== dateKey) return false

          const habitDuration = effectiveDuration
          const habitStartInHours = habitStartHour + habitStartMinute / 60
          const habitEndInHours = habitStartInHours + habitDuration / 60
          const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
          const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60

          return habitStartInHours < meetingEndInHours && habitEndInHours > meetingStartInHours
        })

        const conflictingSession = sessions.find(session => {
          if (!session.actual_start_time || session.scheduled_date !== dateKey) return false

          const sessionStartHour = parseInt(session.actual_start_time.split(':')[0])
          const sessionStartMinute = parseInt(session.actual_start_time.split(':')[1])
          const sessionDuration = (session.scheduled_hours || 1) * 60 // Duration in minutes

          const habitDuration = effectiveDuration
          const habitStartInHours = habitStartHour + habitStartMinute / 60
          const habitEndInHours = habitStartInHours + habitDuration / 60
          const sessionStartInHours = sessionStartHour + sessionStartMinute / 60
          const sessionEndInHours = sessionStartInHours + sessionDuration / 60

          return habitStartInHours < sessionEndInHours && habitEndInHours > sessionStartInHours
        })

        if (conflictingMeeting) {
          const meetingEnd = new Date(conflictingMeeting.end_time)
          const newStartMinute =
            meetingEnd.getMinutes() === 0 ? 0 : meetingEnd.getMinutes() <= 30 ? 30 : 0
          return {
            ...habit,
            topPosition: (newStartMinute / 60) * 100,
            isRescheduled: true,
          }
        }

        if (conflictingSession) {
          const sessionStartHour = parseInt(conflictingSession.actual_start_time!.split(':')[0])
          const sessionStartMinute = parseInt(conflictingSession.actual_start_time!.split(':')[1])
          const sessionDuration = (conflictingSession.scheduled_hours || 1) * 60 // Duration in minutes
          const sessionEndMinute = sessionStartMinute + sessionDuration
          const finalEndMinute = sessionEndMinute % 60

          const newStartMinute = finalEndMinute === 0 ? 0 : finalEndMinute <= 30 ? 30 : 0
          return {
            ...habit,
            topPosition: (newStartMinute / 60) * 100,
            isRescheduled: true,
          }
        }

        return {
          ...habit,
          topPosition: (habitStartMinute / 60) * 100,
          isRescheduled: false,
        }
      })
  }

  // Get sessions for a specific time slot
  const getSessionsForTimeSlot = (timeSlot: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const currentHour = parseInt(timeSlot.split(':')[0])

    return sessions
      .filter(session => {
        if (!session.actual_start_time || session.scheduled_date !== dateStr) return false
        const sessionStartHour = parseInt(session.actual_start_time.split(':')[0])
        return sessionStartHour === currentHour
      })
      .map(session => {
        const minutes = parseInt(session.actual_start_time!.split(':')[1])
        return {
          ...session,
          topPosition: (minutes / 60) * 100,
        }
      })
  }

  // Get task daily logs for a specific time slot
  const getTasksDailyLogsForTimeSlot = (timeSlot: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const currentHour = parseInt(timeSlot.split(':')[0])

    console.log(`🔍 Checking task daily logs for ${dateStr} ${timeSlot}:`, {
      totalLogs: tasksDailyLogs.length,
      logsForDate: tasksDailyLogs.filter(log => log.log_date === dateStr),
      sampleLogs: tasksDailyLogs.slice(0, 3)
    })

    return tasksDailyLogs
      .filter(log => {
        if (log.log_date !== dateStr) return false
        // Use actual_start_time if available, otherwise fall back to scheduled_start_time
        const startTime = log.actual_start_time || log.scheduled_start_time
        if (!startTime) return false
        const logStartHour = parseInt(startTime.split(':')[0])
        return logStartHour === currentHour
      })
      .map(log => {
        // Use actual_start_time if available, otherwise fall back to scheduled_start_time
        const startTime = log.actual_start_time || log.scheduled_start_time
        const minutes = parseInt(startTime!.split(':')[1])
        return {
          ...log,
          topPosition: (minutes / 60) * 100,
        }
      })
  }

  const hourSlots = useMemo(() => getHourSlots(), [])

  return {
    allTasks,
    scheduledTasksCache,
    tasksScheduled,
    baseDate,
    currentTime,
    habits,
    conflictMaps,
    sessions,
    projects,
    meetings,
    tasksDailyLogs,
    isDataLoading,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    dayColumns,
    hourSlots,
    getCurrentTimeLinePosition,
    getWorkHoursRange,
    getTasksForTimeSlot,
    getMeetingsForTimeSlot,
    getHabitsForTimeSlot,
    getSessionsForTimeSlot,
    getTasksDailyLogsForTimeSlot,
    setAllTasks,
    setScheduledTasksCache,
    setTasksScheduled,
  }
}
