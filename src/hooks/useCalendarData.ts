import { useState, useEffect, useMemo, useRef } from 'react'
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
import { syncTodoistTasks } from '../utils/todoistSync'

// Todoist tasks are scheduled in personal hours, separate from work tasks
const TODOIST_HOURS = { start: 19, end: 23 }

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
  const initializingRef = useRef(false)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // Category buffers state  
  const currentWeekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  
  const [dataHash, setDataHash] = useState('')
  const [calendarNotes, setCalendarNotes] = useState<any[]>([])
  const [habitNotes, setHabitNotes] = useState<any[]>([])
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
  const { saveTaskChunks } = useTaskDailyLogs()

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
    let cancelled = false

    const loadAndProcessAllCalendarData = async () => {
      // Prevent multiple simultaneous initializations
      if (initializingRef.current) return
      initializingRef.current = true

      setIsInitializing(true)
      setIsDataLoading(true)

      try {
        if (userLoading || !user) {
          setIsDataLoading(false)
          setIsInitializing(false)
          initializingRef.current = false
          return
        }

        // Step 1: Fetch all base data in parallel and update UI immediately
        const dataPromise = fetchAllCalendarData(user.id)
        const { habits: fetchedHabits, sessions: fetchedSessions, projects: fetchedProjects, meetings: fetchedMeetings, tasksDailyLogs: fetchedTasksDailyLogs, tasks: fetchedTasks, settings: fetchedSettings, calendarNotes: fetchedCalendarNotes, habitNotes: fetchedHabitNotes, categoryBuffers: fetchedCategoryBuffers } = await dataPromise

        if (cancelled) return

        // Step 2: Update UI immediately with base data (shows habits, sessions, meetings)
        setHabits(fetchedHabits)
        setSessions(fetchedSessions)
        setProjects(fetchedProjects)
        setMeetings(fetchedMeetings)
        setTasksDailyLogs(fetchedTasksDailyLogs)
        setSettings(fetchedSettings)
        setCalendarNotes(fetchedCalendarNotes)
        setHabitNotes(fetchedHabitNotes)
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
        // Step 4: Process conflict maps while tasks are loading
        const today = new Date()
        const todayStr = format(today, 'yyyy-MM-dd')
        const filteredTasksDailyLogs = fetchedTasksDailyLogs.filter(log => log.log_date !== todayStr)
        const dayColumnsList = getDayColumns()
        const newConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList, filteredTasksDailyLogs)
        setConflictMaps(newConflictMaps)
        
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

          try {
            // Schedule tasks - use filtered data consistent with conflict computation
            const scheduledTasksResult = await scheduleAllTasks(
              filteredTasks,
              newConflictMaps,
              dayColumnsList,
              getWorkHoursRangeFromSettings,
              scheduleTaskInAvailableSlots,
              saveTaskChunks,
              null, // clearTaskLogsFromTimeForward removed
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
        const calculatedBufferBlocks = await calculateCategoryBufferBlocks(user.id, baseDate, finalConflictMaps, getWorkHoursRange, fetchedHabits, fetchedSettings, fetchedCategoryBuffers)
        setCategoryBufferBlocks(calculatedBufferBlocks)

        // Step 8: Schedule todoist tasks from DB immediately, then sync API in background
        if (fetchedSettings?.todoist_api_key) {
          // Fetch existing todoist tasks from DB (instant, no API call)
          const { data: todoistDbTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('source', 'todoist')
            .eq('user_id', user.id)
            .eq('is_complete', false)

          if (todoistDbTasks && todoistDbTasks.length > 0) {
            const getTodoistHoursRange = () => TODOIST_HOURS
            const todoistConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList, fetchedTasksDailyLogs)
            const todoistScheduleResult = await scheduleAllTasks(
              todoistDbTasks, todoistConflictMaps, dayColumnsList, getTodoistHoursRange,
              scheduleTaskInAvailableSlots, saveTaskChunks, null, // clearTaskLogsFromTimeForward removed
              user.id, fetchedTasksDailyLogs, [], null, todoistDbTasks, new Map()
            )
            setScheduledTasksCache(prev => {
              const merged = new Map(prev)
              todoistScheduleResult.forEach((tasks, dateKey) => {
                const existing = merged.get(dateKey) || []
                const existingIds = new Set(existing.map((t: any) => t.id))
                const newTasks = tasks.filter((t: any) => !existingIds.has(t.id))
                if (newTasks.length > 0) merged.set(dateKey, [...existing, ...newTasks])
              })
              return merged
            })
          }

        }

      } catch (error) {
        console.error('Error in calendar data loading:', error)
        setIsDataLoading(false)
        // Set tasksScheduled to true to prevent infinite loading state
        setTasksScheduled(true)
      } finally {
        setIsInitializing(false)
        initializingRef.current = false
      }
    }

    // Only load if not already scheduled, or if explicitly reset
    if (!tasksScheduled && !userLoading && user) {
      loadAndProcessAllCalendarData()
    }

    return () => {
      cancelled = true
      initializingRef.current = false
    }
  }, [tasksScheduled, user?.id, userLoading])

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

          const today = new Date()
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
              null, // clearTaskLogsFromTimeForward removed
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
  }, [habits, sessions, meetings, allTasks, tasksDailyLogs, dataHash, tasksScheduled, dayColumns, getWorkHoursRange, saveTaskChunks])

  // Get tasks for a specific time slot
  // --- Pre-indexed Maps for O(1) time slot lookups ---
  const EMPTY: any[] = []

  const tasksIndex = useMemo(() => {
    if (!tasksScheduled) return new Map<string, any[]>()
    const index = new Map<string, any[]>()
    scheduledTasksCache.forEach((chunks, dateKey) => {
      chunks.forEach(chunk => {
        const hour = chunk.startTime ? Math.floor(chunk.startTime) : chunk.startHour
        if (hour < 6) return
        const key = `${dateKey}-${hour}`
        const arr = index.get(key) || []
        arr.push(chunk)
        index.set(key, arr)
      })
    })
    return index
  }, [scheduledTasksCache, tasksScheduled])

  const meetingsIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    meetings.forEach(meeting => {
      const meetingStart = new Date(meeting.start_time)
      const hour = meetingStart.getHours()
      if (hour < 6) return
      const key = `${format(meetingStart, 'yyyy-MM-dd')}-${hour}`
      const arr = index.get(key) || []
      arr.push(meeting)
      index.set(key, arr)
    })
    return index
  }, [meetings])

  const getTasksForTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return tasksIndex.get(key) || EMPTY
  }

  const getMeetingsForTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return meetingsIndex.get(key) || EMPTY
  }

  // Get habits for a specific time slot
  const habitsIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    // Pre-index meetings and sessions by date for O(1) conflict lookups
    const meetingsByDate = new Map<string, any[]>()
    meetings.forEach(m => {
      const start = new Date(m.start_time)
      const key = format(start, 'yyyy-MM-dd')
      const arr = meetingsByDate.get(key) || []
      arr.push(m)
      meetingsByDate.set(key, arr)
    })
    const sessionsByDate = new Map<string, any[]>()
    sessions.forEach(s => {
      const arr = sessionsByDate.get(s.scheduled_date) || []
      arr.push(s)
      sessionsByDate.set(s.scheduled_date, arr)
    })
    const workHours = getWorkHoursRange()

    for (const habit of habits) {
      if (habit.habits_types?.scheduling_rule === 'non_calendar') continue

      for (const col of dayColumns) {
        const dateKey = col.dateStr
        if (habit.created_at) {
          const creationDate = new Date(habit.created_at).toISOString().split('T')[0]
          if (dateKey < creationDate) continue
        }

        const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateKey)
        if (dailyLog?.is_skipped) continue

        const effectiveStartTime = getEffectiveHabitStartTime(habit, dateKey, dailyLog)
        const effectiveDuration = dailyLog?.duration || habit.duration || 0
        if (!effectiveStartTime) continue

        const habitStartHour = parseInt(effectiveStartTime.split(':')[0])
        const habitStartMinute = parseInt(effectiveStartTime.split(':')[1])
        if (habitStartHour === 5) continue

        const habitStartInHours = habitStartHour + habitStartMinute / 60
        const habitEndInHours = habitStartInHours + effectiveDuration / 60

        // Check meeting conflicts (O(1) date lookup, then small array scan)
        const dateMeetings = meetingsByDate.get(dateKey) || []
        const conflictingMeeting = dateMeetings.find(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingStartH = meetingStart.getHours() + meetingStart.getMinutes() / 60
          const meetingEndH = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
          return habitStartInHours < meetingEndH && habitEndInHours > meetingStartH
        })

        // Check session conflicts
        const dateSessions = sessionsByDate.get(dateKey) || []
        const conflictingSession = !conflictingMeeting ? dateSessions.find(session => {
          const defaultStart = `${workHours.start.toString().padStart(2, '0')}:00`
          const sTime = session.actual_start_time || defaultStart
          const sH = parseInt(sTime.split(':')[0])
          const sM = parseInt(sTime.split(':')[1])
          const sStartH = sH + sM / 60
          const sEndH = sStartH + ((session.scheduled_hours || 1) * 60) / 60
          return habitStartInHours < sEndH && habitEndInHours > sStartH
        }) : null

        // Determine final hour and position
        let finalHour: number
        let topPosition: number
        let isRescheduled = false

        if (conflictingMeeting) {
          const meetingEnd = new Date(conflictingMeeting.end_time)
          const endMin = meetingEnd.getMinutes()
          finalHour = meetingEnd.getHours() + (endMin > 30 ? 1 : 0)
          const newStartMinute = endMin === 0 ? 0 : endMin <= 30 ? 30 : 0
          topPosition = (newStartMinute / 60) * 100
          isRescheduled = true
        } else if (conflictingSession) {
          const sTime = conflictingSession.actual_start_time!
          const sH = parseInt(sTime.split(':')[0])
          const sM = parseInt(sTime.split(':')[1])
          const sDur = (conflictingSession.scheduled_hours || 1) * 60
          const sEndM = sM + sDur
          const sEndHour = sH + Math.floor(sEndM / 60)
          const finalEndMin = sEndM % 60
          finalHour = sEndHour + (finalEndMin > 30 ? 1 : 0)
          const newStartMinute = finalEndMin === 0 ? 0 : finalEndMin <= 30 ? 30 : 0
          topPosition = (newStartMinute / 60) * 100
          isRescheduled = true
        } else {
          finalHour = habitStartHour
          topPosition = (habitStartMinute / 60) * 100
        }

        const key = `${dateKey}-${finalHour}`
        const arr = index.get(key) || []
        arr.push({ ...habit, topPosition, isRescheduled })
        index.set(key, arr)
      }
    }
    return index
  }, [habits, meetings, sessions, dayColumns])

  const getHabitsForTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return habitsIndex.get(key) || EMPTY
  }

  // Get sessions for a specific time slot
  const sessionsIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    const workHours = getWorkHoursRange()
    const defaultStartTime = `${workHours.start.toString().padStart(2, '0')}:00`
    sessions.forEach(session => {
      const dateStr = session.scheduled_date
      if (!dateStr) return
      const startTime = session.actual_start_time || defaultStartTime
      const hour = parseInt(startTime.split(':')[0])
      if (hour < 6) return
      const minutes = parseInt(startTime.split(':')[1])
      const key = `${dateStr}-${hour}`
      const arr = index.get(key) || []
      arr.push({ ...session, topPosition: (minutes / 60) * 100 })
      index.set(key, arr)
    })
    return index
  }, [sessions])

  const getSessionsForTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return sessionsIndex.get(key) || EMPTY
  }

  const tasksDailyLogsIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    tasksDailyLogs.forEach(log => {
      const startTime = log.actual_start_time || log.scheduled_start_time
      if (!startTime) return
      const hour = parseInt(startTime.split(':')[0])
      if (hour === 5) return
      const minutes = parseInt(startTime.split(':')[1])
      const key = `${log.log_date}-${hour}`
      const arr = index.get(key) || []
      arr.push({ ...log, topPosition: (minutes / 60) * 100 })
      index.set(key, arr)
    })
    return index
  }, [tasksDailyLogs])

  const getTasksDailyLogsForTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return tasksDailyLogsIndex.get(key) || EMPTY
  }

  const buffersIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    buffers.forEach((buffer, dateStr) => {
      if (!buffer || !buffer.isActive) return
      const hour = parseInt(buffer.startTime.split(':')[0])
      if (hour < 6) return
      const minutes = parseInt(buffer.startTime.split(':')[1])
      const key = `${dateStr}-${hour}`
      index.set(key, [{ ...buffer, topPosition: (minutes / 60) * 100 }])
    })
    return index
  }, [buffers])

  const categoryBuffersIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    categoryBufferBlocks.forEach(block => {
      const blockStartHour = Math.floor(block.start_time)
      const blockEndHour = Math.ceil(block.start_time + block.duration)
      for (let hour = blockStartHour; hour < blockEndHour; hour++) {
        const key = `${block.dateStr}-${hour}`
        const arr = index.get(key) || []
        arr.push({ ...block, topPosition: ((block.start_time - hour) / 1) * 100 })
        index.set(key, arr)
      }
    })
    return index
  }, [categoryBufferBlocks])

  const getBuffersForCalendarTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return buffersIndex.get(key) || EMPTY
  }

  const getCategoryBuffersForTimeSlot = (timeSlot: string, date: Date) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${parseInt(timeSlot.split(':')[0])}`
    return categoryBuffersIndex.get(key) || EMPTY
  }


  const hourSlots = useMemo(() => getHourSlots(), [])

  // Calendar notes helpers
  const getNotesForDateTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const targetDateTime = new Date(date)
    targetDateTime.setHours(hours, minutes, 0, 0)

    return calendarNotes.filter(note => {
      const pinnedDateTime = new Date(note.pinned_date)
      return Math.abs(pinnedDateTime.getTime() - targetDateTime.getTime()) < 60000
    })
  }

  const addCalendarNote = async (pinnedDate: string, noteId: string) => {
    const { data, error } = await supabase
      .from('calendar_notes')
      .insert({ pinned_date: pinnedDate, note_id: noteId })
      .select('*, habits_notes:note_id(id, content, note_date, created_at)')
      .single()
    if (error) throw error
    setCalendarNotes(prev => [...prev, data])
    return data
  }

  const addHabitNote = async (content: string, noteDate: string) => {
    const { data, error } = await supabase
      .from('habits_notes')
      .insert({ content, note_date: noteDate })
      .select()
      .single()
    if (error) throw error
    setHabitNotes(prev => [data, ...prev])
    return data
  }

  const removeCalendarNote = async (calendarNoteId: string) => {
    const { error } = await supabase
      .from('calendar_notes')
      .delete()
      .eq('id', calendarNoteId)
    if (error) throw error
    setCalendarNotes(prev => prev.filter(note => note.id !== calendarNoteId))
  }

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
    calendarNotes,
    habitNotes,
    getNotesForDateTime,
    addCalendarNote,
    addHabitNote,
    removeCalendarNote,
    removeTaskFromCalendar: (taskId: string) => {
      setTasksDailyLogs(prev => prev.filter(log => log.task_id !== taskId))
      setScheduledTasksCache(prev => {
        const updated = new Map(prev)
        updated.forEach((chunks, dateKey) => {
          const filtered = chunks.filter((c: any) => !c.id?.startsWith(taskId))
          if (filtered.length !== chunks.length) updated.set(dateKey, filtered)
        })
        return updated
      })
    },
    setAllTasks,
    setScheduledTasksCache,
    setTasksScheduled,
  }
}
