import { useState, useEffect, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { useTaskDailyLogs } from './useTaskDailyLogs'
import { useUserContext } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'
import { fetchAllCalendarData, fetchTasksForProjects } from '../utils/calendarDataFetcher'
import { computeConflictMaps } from '../utils/calendarConflicts'
import { scheduleAllTasks, scheduleTaskInAvailableSlots } from '../utils/taskScheduling'
import { addMeeting as addMeetingUtil, updateMeeting as updateMeetingUtil, deleteMeeting as deleteMeetingUtil } from '../utils/meetingManager'
import { getEffectiveHabitStartTime } from '../utils/habitScheduling'
import { generateBuffersForDays, getBuffersForTimeSlot, BufferTime } from '../utils/bufferManager'
import { BufferBlock } from '../types'
import { startOfWeek } from 'date-fns'
import { calculateCategoryBufferBlocks } from '../utils/categoryBufferCalculation'

export const useCalendarData = (windowWidth: number, baseDate: Date = new Date()) => {
  const { user, loading: userLoading } = useUserContext()
  const [allTasks, setAllTasks] = useState<any[]>([])
  const [habits, setHabits] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [tasksDailyLogs, setTasksDailyLogs] = useState<any[]>([])
  const [scheduledTasksCache, setScheduledTasksCache] = useState<Map<string, any[]>>(new Map())
  const [tasksScheduled, setTasksScheduled] = useState(false)
  const [buffers, setBuffers] = useState<Map<string, BufferTime>>(new Map())
  const [categoryBufferBlocks, setCategoryBufferBlocks] = useState<BufferBlock[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // Category buffers state  
  const currentWeekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  
  const [dataHash, setDataHash] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [conflictMaps, setConflictMaps] = useState({ 
    habitConflicts: new Map(), 
    sessionConflicts: new Map(), 
    meetingConflicts: new Map(),
    tasksDailyLogsConflicts: new Map(),
    bufferConflicts: new Map()
  })

  // getWorkHoursRange function using our local settings state
  const getWorkHoursRange = () => {
    if (!settings) {
      return { start: 10, end: 22 }
    }
    const start = parseInt(settings.work_hours_start.split(':')[0], 10)
    const end = parseInt(settings.work_hours_end.split(':')[0], 10)
    return { start, end }
  }
  const { saveTaskChunks, clearTaskLogsForDate, clearTaskLogsFromTimeForward } = useTaskDailyLogs()

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
      // Prevent multiple simultaneous initializations
      if (isInitializing) return
      
      console.log('🔥 CALENDAR DATA LOAD STARTED', { user: user?.id, userLoading, tasksScheduled })
      setIsInitializing(true)
      setIsDataLoading(true)
      
      try {
        if (userLoading || !user) {
          setIsDataLoading(false)
          setIsInitializing(false)
          return
        }

        // Step 1: Fetch all base data in parallel and update UI immediately
        const dataPromise = fetchAllCalendarData(user.id)
        const { habits: fetchedHabits, sessions: fetchedSessions, projects: fetchedProjects, meetings: fetchedMeetings, tasksDailyLogs: fetchedTasksDailyLogs, tasks: fetchedTasks, settings: fetchedSettings } = await dataPromise

        // Step 2: Update UI immediately with base data (shows habits, sessions, meetings)
        setHabits(fetchedHabits)
        setSessions(fetchedSessions)
        setProjects(fetchedProjects)
        setMeetings(fetchedMeetings)
        setTasksDailyLogs(fetchedTasksDailyLogs)
        setSettings(fetchedSettings)
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

        // Step 3: Fetch and filter tasks (exclude tasks from projects with sessions)
        const tasksPromise = fetchTasksForProjects(user.id, fetchedProjects, fetchedSessions)
        console.log('[BUFFER DEBUG] load tasks')
        // Step 4: Process conflict maps while tasks are loading
        const today = new Date()
        const todayStr = format(today, 'yyyy-MM-dd')
        const filteredTasksDailyLogs = fetchedTasksDailyLogs.filter(log => log.log_date !== todayStr)
        const dayColumnsList = getDayColumns()
        const newConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList, filteredTasksDailyLogs)
        setConflictMaps(newConflictMaps)
        console.log('[BUFFER DEBUG] generating')
        
        // Step 4.5: Generate daily buffers (extracted from conflict maps)
        const generatedBuffers = generateBuffersForDays(dayColumnsList, fetchedMeetings)
        setBuffers(generatedBuffers)


        // Step 5: Wait for filtered tasks and schedule them
        const filteredTasks = await tasksPromise
        setAllTasks(filteredTasks)

        // Step 6: Check if we need to regenerate tasks
        const newDataHash = createDataHash(fetchedHabits, fetchedSessions, fetchedMeetings, filteredTasks, fetchedTasksDailyLogs)
        const needsRegeneration = !tasksScheduled || dataHash !== newDataHash

        if (needsRegeneration) {
          
          setDataHash(newDataHash)

          // Clear today's task logs from current time forward only when regenerating
          const now = new Date()
          const isToday = format(today, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
          
          if (isToday) {
            // Only clear logs from current time forward for today
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            await clearTaskLogsFromTimeForward(user.id, today, currentTime)
          } else {
            // For other dates, clear all logs (future dates)
            await clearTaskLogsForDate(user.id, today)
          }

          try {
            // Schedule tasks - use filtered data consistent with conflict computation
            const scheduledTasksResult = await scheduleAllTasks(
              filteredTasks,
              newConflictMaps,
              dayColumnsList,
              getWorkHoursRangeFromSettings,
              scheduleTaskInAvailableSlots,
              saveTaskChunks,
              clearTaskLogsFromTimeForward,
              user.id,
              filteredTasksDailyLogs,
              fetchedSettings?.weekend_days || ['saturday', 'sunday'],
              fetchedSettings,
              fetchedTasks, // allTasks
              new Map() // scheduledTasksCache - empty during initial scheduling
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

        // Step 7: Calculate category buffer blocks after task scheduling
        // Need to recompute conflicts including scheduled tasks
        const finalConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList, filteredTasksDailyLogs)
        console.log('final conflict', finalConflictMaps)
        const calculatedBufferBlocks = await calculateCategoryBufferBlocks(user.id, baseDate, finalConflictMaps, getWorkHoursRange, fetchedHabits, fetchedSettings)
        console.log('[BUFFER DEBUG]', calculatedBufferBlocks)
        setCategoryBufferBlocks(calculatedBufferBlocks)
        
      } catch (error) {
        console.error('Error in calendar data loading:', error)
        setIsDataLoading(false)
        // Set tasksScheduled to true to prevent infinite loading state
        setTasksScheduled(true)
      } finally {
        setIsInitializing(false)
      }
    }

    // Only load if not already scheduled, or if explicitly reset
    if (!tasksScheduled && !userLoading && user && !isInitializing) {
      loadAndProcessAllCalendarData()
    }
  }, [tasksScheduled, user?.id, userLoading, isInitializing])

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
    const hours = []
    // Go from 6am to 4am next day (22 hours total)
    // 6am-11pm (6-23), then 12am-4am (0-4)
    for (let i = 6; i <= 23; i++) {
      const hour12 = i > 12 ? i - 12 : i === 0 ? 12 : i
      const ampm = i >= 12 ? 'PM' : 'AM'
      const hourStr = hour12.toString() + ':00 ' + ampm
      const timeValue = i.toString().padStart(2, '0') + ':00'
      hours.push({ display: hourStr, time: timeValue })
    }
    // Add 12am-4am (0-4)
    for (let i = 0; i <= 4; i++) {
      const hour12 = i === 0 ? 12 : i
      const ampm = 'AM'
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

    if (currentHour < 6 || currentHour >= end) return null

    const isToday = format(date, 'yyyy-MM-dd') === format(currentTime, 'yyyy-MM-dd')
    if (!isToday) return null

    const hourIndex = currentHour - 6
    const minutePercentage = currentMinute / 60
    const totalPosition = (hourIndex + minutePercentage) * 64

    return totalPosition
  }

  // Meeting management functions
  const addMeeting = async (meetingData: any) => {
    const data = await addMeetingUtil(meetingData)
    setMeetings(prev => [...prev, data])
    
    // After adding meeting (especially past meetings with rollover), 
    // we need to refresh all affected data
    await refreshCalendarData()
    return data
  }

  const updateMeeting = async (id: string, meetingData: any) => {
    const data = await updateMeetingUtil(id, meetingData)
    setMeetings(prev => prev.map(m => m.id === id ? data : m))
    
    // After updating meeting, refresh data in case of rollover changes
    await refreshCalendarData()
    return data
  }

  const deleteMeeting = async (id: string) => {
    await deleteMeetingUtil(id)
    setMeetings(prev => prev.filter(m => m.id !== id))
    
    // After deleting meeting, refresh data
    await refreshCalendarData()  
  }

  // Helper function to refresh all calendar data after meeting changes
  const refreshCalendarData = async () => {
    try {
      if (!user) return

      // Re-fetch only tasks (task daily logs shouldn't need re-fetching after meeting changes)
      const updatedTasks = await fetchTasksForProjects(user.id, projects, sessions)
      const updatedTasksDailyLogs = tasksDailyLogs // Use existing task daily logs

      
      
      // Update state with fresh data
      setAllTasks(updatedTasks)
      setTasksDailyLogs(updatedTasksDailyLogs)

      // Recalculate conflict maps with updated meetings
      const today = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const filteredTasksDailyLogs = updatedTasksDailyLogs.filter(log => log.log_date !== todayStr)
      const newConflictMaps = computeConflictMaps(habits, sessions, meetings, dayColumns, filteredTasksDailyLogs)
      setConflictMaps(newConflictMaps)

      // Regenerate category buffer blocks with updated conflict maps
      const calculatedBufferBlocks = await calculateCategoryBufferBlocks(user.id, baseDate, newConflictMaps, getWorkHoursRange, habits, settings)
      setCategoryBufferBlocks(calculatedBufferBlocks)
      
    } catch (error) {
      console.error('❌ Error refreshing calendar data:', error)
    }
  }



  // Trigger regeneration when data changes
  useEffect(() => {
    if (!tasksScheduled || !dataHash) return // Don't trigger on initial load
    
    const newDataHash = createDataHash(habits, sessions, meetings, allTasks, tasksDailyLogs)
    if (dataHash !== newDataHash) {
      
      
      // Trigger immediate regeneration
      const regenerateTasks = async () => {
        try {
          if (!user) return

          setDataHash(newDataHash)
          
          // Clear today's task logs from current time forward and regenerate
          const today = new Date()
          const now = new Date()
          const isToday = format(today, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
          
          if (isToday) {
            // Only clear logs from current time forward for today
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            await clearTaskLogsFromTimeForward(user.id, today, currentTime)
          } else {
            // For other dates, clear all logs (future dates)
            await clearTaskLogsForDate(user.id, today)
          }
          
          // Filter out today's task logs for conflict computation
          const todayStr = format(today, 'yyyy-MM-dd')
          const filteredTasksDailyLogs = tasksDailyLogs.filter(log => log.log_date !== todayStr)
          
          // Recompute conflicts with new data (includes buffer conflicts)
          const newConflictMaps = computeConflictMaps(habits, sessions, meetings, dayColumns, filteredTasksDailyLogs)
          setConflictMaps(newConflictMaps)
          
          // Regenerate buffers with updated meetings
          const regeneratedBuffers = generateBuffersForDays(dayColumns, meetings)
          setBuffers(regeneratedBuffers)

          try {
            // Schedule tasks with new conflicts - use filtered data consistent with clearing
            const scheduledTasksResult = await scheduleAllTasks(
              allTasks,
              newConflictMaps,
              dayColumns,
              getWorkHoursRange,
              scheduleTaskInAvailableSlots,
              saveTaskChunks,
              clearTaskLogsFromTimeForward,
              user.id,
              filteredTasksDailyLogs,
              settings?.weekend_days || ['saturday', 'sunday'],
              settings,
              allTasks, // allTasks
              scheduledTasksCache // Pass existing scheduledTasksCache for regeneration
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
  }, [habits, sessions, meetings, allTasks, tasksDailyLogs, dataHash, tasksScheduled, dayColumns, getWorkHoursRange, saveTaskChunks, clearTaskLogsFromTimeForward])

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
      
      // Hide anything before 6 AM
      if (taskStartHour < 6) return false
      
      const matches = taskStartHour === currentHour
      return matches
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

      // Hide anything before 6 AM
      if (meetingHour < 6) return false

      return meetingDate === dateKey && meetingHour === currentHour
    })
  }

  // Get habits for a specific time slot
  const getHabitsForTimeSlot = (timeSlot: string, date: Date) => {
    const currentHour = parseInt(timeSlot.split(':')[0])
    const dateKey = format(date, 'yyyy-MM-dd')

    return habits
      .filter(habit => {
        // Filter out non-calendar habits
        if (habit.habits_types?.scheduling_rule === 'non_calendar') {
          return false
        }
        // Only show habits that existed on this date
        if (habit.created_at) {
          const habitCreationDate = new Date(habit.created_at).toISOString().split('T')[0]
          if (dateKey < habitCreationDate) return false
        }
        
        // Check if there's a daily log with a scheduled start time for this date
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateKey)
        
        // Skip habit if it's marked as skipped for this date
        if (dailyLog?.is_skipped) return false
        
        let effectiveStartTime = getEffectiveHabitStartTime(habit, dateKey, dailyLog)
        const effectiveDuration = dailyLog?.duration || habit.duration || 0

        if (!effectiveStartTime) return false

        const habitStartHour = parseInt(effectiveStartTime.split(':')[0])
        const habitStartMinute = parseInt(effectiveStartTime.split(':')[1])

        // Allow early morning hours (0-4am) to show in calendar since we extended it
        // Only hide hours 5am since calendar starts at 6am
        if (habitStartHour === 5) {
          return false
        }

        // Allow early morning hours (0-4am) to remain as-is since calendar now shows them

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
          if (session.scheduled_date !== dateKey) return false

          // Handle both scheduled and started sessions
          const workHours = getWorkHoursRange()
          const defaultStartTime = `${workHours.start.toString().padStart(2, '0')}:00`
          const sessionStartTime = session.actual_start_time || defaultStartTime
          const sessionStartHour = parseInt(sessionStartTime.split(':')[0])
          const sessionStartMinute = parseInt(sessionStartTime.split(':')[1])
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
        let effectiveStartTime = getEffectiveHabitStartTime(habit, dateKey, dailyLog)
        const effectiveDuration = dailyLog?.duration || habit.duration || 0

        // Allow early morning hours since calendar now shows 0-4am

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
          if (session.scheduled_date !== dateKey) return false

          // Handle both scheduled and started sessions
          const workHours = getWorkHoursRange()
          const defaultStartTime = `${workHours.start.toString().padStart(2, '0')}:00`
          const sessionStartTime = session.actual_start_time || defaultStartTime
          const sessionStartHour = parseInt(sessionStartTime.split(':')[0])
          const sessionStartMinute = parseInt(sessionStartTime.split(':')[1])
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
        // Check if session is scheduled for this date
        if (session.scheduled_date !== dateStr) return false
        
        // For scheduled sessions without actual_start_time, we need to determine their display time
        // Use work hours start time or default to 9 AM
        const workHours = getWorkHoursRange()
        const defaultStartTime = `${workHours.start.toString().padStart(2, '0')}:00`
        const startTime = session.actual_start_time || defaultStartTime
        const sessionStartHour = parseInt(startTime.split(':')[0])
        
        // Hide anything before 6 AM
        if (sessionStartHour < 6) return false
        
        return sessionStartHour === currentHour
      })
      .map(session => {
        const workHours = getWorkHoursRange()
        const defaultStartTime = `${workHours.start.toString().padStart(2, '0')}:00`
        const startTime = session.actual_start_time || defaultStartTime
        const minutes = parseInt(startTime.split(':')[1])
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

    return tasksDailyLogs
      .filter(log => {
        if (log.log_date !== dateStr) return false
        // Use actual_start_time if available, otherwise fall back to scheduled_start_time
        const startTime = log.actual_start_time || log.scheduled_start_time
        if (!startTime) return false
        const logStartHour = parseInt(startTime.split(':')[0])
        
        // Allow early morning hours (0-4am) to show in calendar since we extended it
        // Only hide 5am since calendar starts at 6am
        if (logStartHour === 5) return false
        
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

  // Get buffers for a specific time slot (daily buffers)
  const getBuffersForCalendarTimeSlot = (timeSlot: string, date: Date) => {
    return getBuffersForTimeSlot(timeSlot, date, buffers)
  }

  // Get category buffers for a specific time slot
  const getCategoryBuffersForTimeSlot = (timeSlot: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    // Early return if no buffer blocks exist for this specific date
    const hasBuffersForDate = categoryBufferBlocks.some(block => block.dateStr === dateStr)
    if (!hasBuffersForDate) {
      return []
    }

    
    console.log(`[BUFFER DEBUG] getCategoryBuffersForTimeSlot called - timeSlot: ${timeSlot}, date: ${dateStr}`)
    console.log('[BUFFER DEBUG] All categoryBufferBlocks:', categoryBufferBlocks)
    
    const currentHour = parseInt(timeSlot.split(':')[0])
    
    const matchingBlocks = categoryBufferBlocks.filter(block => {
      console.log(`[BUFFER DEBUG] Checking block - dateStr: ${block.dateStr}, start_time: ${block.start_time}, duration: ${block.duration}`)
      
      // First check if the buffer block is for the correct date
      if (block.dateStr !== dateStr) {
        console.log(`[BUFFER DEBUG] Date mismatch: ${block.dateStr} !== ${dateStr}`)
        return false
      }
      
      // Check if this buffer block should appear in this time slot
      const blockStartHour = Math.floor(block.start_time)
      const blockEndHour = Math.ceil(block.start_time + block.duration)
      
      console.log(`[BUFFER DEBUG] Time check - blockStartHour: ${blockStartHour}, blockEndHour: ${blockEndHour}, currentHour: ${currentHour}`)
      
      // Check if the buffer block overlaps with this time slot
      const shouldShow = blockStartHour <= currentHour && currentHour < blockEndHour
      console.log(`[BUFFER DEBUG] Should show buffer in this slot: ${shouldShow}`)
      
      return shouldShow
    }).map(block => ({
      ...block,
      // Calculate position within the hour slot
      topPosition: ((block.start_time - currentHour) / 1) * 100
    }))
    
    console.log(`[BUFFER DEBUG] Returning ${matchingBlocks.length} matching buffer blocks:`, matchingBlocks)
    return matchingBlocks
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
    getBuffersForCalendarTimeSlot,
    getCategoryBuffersForTimeSlot,
    buffers,
    categoryBufferBlocks,
    settings,
    setAllTasks,
    setScheduledTasksCache,
    setTasksScheduled,
  }
}
