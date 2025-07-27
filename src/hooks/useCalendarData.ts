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
  const [scheduledTasksCache, setScheduledTasksCache] = useState<Map<string, any[]>>(new Map())
  const [tasksScheduled, setTasksScheduled] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [conflictMaps, setConflictMaps] = useState({ 
    habitConflicts: new Map(), 
    sessionConflicts: new Map(), 
    meetingConflicts: new Map() 
  })

  const { getWorkHoursRange } = useSettings()
  const { saveTaskChunks, clearTaskLogsForDate } = useTaskDailyLogs()

  // Reset when date changes
  useEffect(() => {
    setTasksScheduled(false)
    setScheduledTasksCache(new Map())
  }, [baseDate])

  // Single consolidated data loading and processing effect
  useEffect(() => {
    // Only run once and prevent re-runs if already scheduled
    if (tasksScheduled) return

    const loadAndProcessAllCalendarData = async () => {
      console.log('📊 Starting consolidated calendar data load...')
      setIsDataLoading(true)
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsDataLoading(false)
          return
        }

        // Step 1: Fetch all base data in parallel
        const { habits: fetchedHabits, sessions: fetchedSessions, projects: fetchedProjects, meetings: fetchedMeetings } = 
          await fetchAllCalendarData(user.id)

        // Step 2: Set base data
        setHabits(fetchedHabits)
        setSessions(fetchedSessions)
        setProjects(fetchedProjects)
        setMeetings(fetchedMeetings)

        // Step 3: Fetch tasks for projects without sessions
        const fetchedTasks = await fetchTasksForProjects(user.id, fetchedProjects, fetchedSessions)
        setAllTasks(fetchedTasks)

        // Step 4: Compute conflict maps
        const dayColumnsList = getDayColumns()
        const newConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList)
        setConflictMaps(newConflictMaps)

        // Step 5: Schedule tasks
        const scheduledTasksResult = await scheduleAllTasks(
          fetchedTasks,
          newConflictMaps,
          dayColumnsList,
          getWorkHoursRange,
          scheduleTaskInAvailableSlots,
          saveTaskChunks,
          clearTaskLogsForDate,
          user.id
        )
        setScheduledTasksCache(scheduledTasksResult)
        setTasksScheduled(true)

        console.log('🎯 Calendar data loading and processing complete!')
        
      } catch (error) {
        console.error('Error in consolidated calendar data loading:', error)
      } finally {
        setIsDataLoading(false)
      }
    }

    loadAndProcessAllCalendarData()
  }, [baseDate]) // Only run when baseDate changes

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
        // Check if there's a daily log with a scheduled start time for this date
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateKey)
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

        return habitStartHour === currentHour
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
    setAllTasks,
    setScheduledTasksCache,
    setTasksScheduled,
  }
}
