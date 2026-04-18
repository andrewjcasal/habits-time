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

// Hours 0-4 on the grid belong to the previous day's column
function getColumnDate(dateStr: string, hour: number): string {
  if (hour >= 0 && hour < 5) {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    return format(d, 'yyyy-MM-dd')
  }
  return dateStr
}

// Todoist tasks are scheduled in personal hours, separate from work tasks
const TODOIST_WEEKDAY_HOURS = { start: 19, end: 23 }
const TODOIST_WEEKEND_HOURS = { start: 10, end: 22 }

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

        // Phase 1: Compute synchronous data and render grid immediately
        const today = new Date()
        const todayStr = format(today, 'yyyy-MM-dd')
        const filteredTasksDailyLogs = fetchedTasksDailyLogs.filter(log => log.log_date !== todayStr)
        const dayColumnsList = getDayColumns()
        const newConflictMaps = computeConflictMaps(fetchedHabits, fetchedSessions, fetchedMeetings, dayColumnsList, filteredTasksDailyLogs)
        const generatedBuffers = generateBuffersForDays(dayColumnsList, fetchedMeetings)

        if (cancelled) return
        setHabits(fetchedHabits)
        setSessions(fetchedSessions)
        setProjects(fetchedProjects)
        setMeetings(fetchedMeetings)
        setTasksDailyLogs(fetchedTasksDailyLogs)
        setSettings(fetchedSettings)
        setCalendarNotes(fetchedCalendarNotes)
        setHabitNotes(fetchedHabitNotes)
        setConflictMaps(newConflictMaps)
        setIsDataLoading(false)

        // Phase 2: Task scheduling + buffers in parallel (background)
        const getWorkHoursRangeFromSettings = () => {
          if (!fetchedSettings) return { start: 10, end: 22 }
          const start = parseInt(fetchedSettings.work_hours_start.split(':')[0], 10)
          const end = parseInt(fetchedSettings.work_hours_end.split(':')[0], 10)
          return { start, end }
        }

        const [filteredTasks, calculatedBufferBlocks] = await Promise.all([
          fetchTasksForProjects(user.id, fetchedProjects, fetchedSessions),
          calculateCategoryBufferBlocks(user.id, baseDate, newConflictMaps, getWorkHoursRange, fetchedHabits, fetchedSettings, fetchedCategoryBuffers),
        ])

        if (cancelled) return
        setAllTasks(filteredTasks)
        setBuffers(generatedBuffers)
        setCategoryBufferBlocks(calculatedBufferBlocks)

        // Task scheduling
        const newDataHash = createDataHash(fetchedHabits, fetchedSessions, fetchedMeetings, filteredTasks, fetchedTasksDailyLogs)
        const needsRegeneration = !tasksScheduled || dataHash !== newDataHash

        if (needsRegeneration) {
          setDataHash(newDataHash)
          try {
            const scheduledResult = await scheduleAllTasks(
              filteredTasks,
              newConflictMaps,
              dayColumnsList,
              getWorkHoursRangeFromSettings,
              scheduleTaskInAvailableSlots,
              saveTaskChunks,
              user.id,
              filteredTasksDailyLogs,
              fetchedSettings?.weekend_days || ['saturday', 'sunday'],
              fetchedSettings,
              fetchedTasks,
              new Map()
            )
            if (cancelled) return
            setScheduledTasksCache(scheduledResult)
          } catch (error) {
            console.error('❌ Task scheduling failed:', error)
          }
        }
        setTasksScheduled(true)

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
    const yesterdayStr = format(addDays(today, -1), 'yyyy-MM-dd')

    const columnCount = windowWidth > 600 ? 7 : 1

    return Array.from({ length: columnCount }, (_, i) => {
      const date = addDays(baseDate, i)
      const dateStr = format(date, 'yyyy-MM-dd')

      let label: string
      if (dateStr === todayStr) {
        label = 'Today'
      } else if (dateStr === tomorrowStr) {
        label = 'Tomorrow'
      } else if (dateStr === yesterdayStr) {
        label = 'Yesterday'
      } else {
        label = columnCount === 1
          ? `${format(date, 'EEEEE')} ${date.getMonth() + 1}/${date.getDate()}`
          : format(date, 'EEE, MMM d')
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

    // Grid layout: 6am-11pm (hours 6-23), then 12am-4am (hours 0-4)
    // Hours 0-4 visually belong to the PREVIOUS day's column
    const isLateNight = currentHour >= 0 && currentHour < 5
    const todayStr = format(currentTime, 'yyyy-MM-dd')
    const dateStr = format(date, 'yyyy-MM-dd')

    if (isLateNight) {
      // At 12:15am Mar 27, the line should show in the Mar 26 column
      const yesterday = new Date(currentTime)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
      if (dateStr !== yesterdayStr) return null
    } else {
      if (dateStr !== todayStr) return null
      if (currentHour < 6) return null // 5am gap — not on grid
    }

    // Calculate position: hours 6-23 = index 0-17, hours 0-4 = index 18-22
    const hourIndex = isLateNight ? (currentHour + 18) : (currentHour - 6)
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

      // Re-fetch only tasks (task daily logs managed separately)
      const updatedTasks = await fetchTasksForProjects(user.id, projects, sessions)

      // Update state with fresh data
      setAllTasks(updatedTasks)

      // Recalculate conflict maps with updated meetings
      const today = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const filteredTasksDailyLogs = tasksDailyLogs.filter(log => log.log_date !== todayStr)
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
        if (hour === 5) return
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
      const meetingEnd = new Date(meeting.end_time)
      const startHour = meetingStart.getHours()
      const startMin = meetingStart.getMinutes()
      const startDateStr = format(meetingStart, 'yyyy-MM-dd')

      // Calculate total duration in hours
      const durationMs = meetingEnd.getTime() - meetingStart.getTime()
      const durationHours = durationMs / (1000 * 60 * 60)

      // Determine which hours this meeting spans
      const startTotalMin = startHour * 60 + startMin
      const endTotalMin = startTotalMin + durationHours * 60

      // Index at the start hour (primary entry)
      if (startHour !== 5) {
        const key = `${getColumnDate(startDateStr, startHour)}-${startHour}`
        const arr = index.get(key) || []
        arr.push(meeting)
        index.set(key, arr)
      }

      // Check if meeting crosses the 5am gap (late-night → morning = column split)
      // Late night hours 0-4 are on prev day's column, hours 6+ are on the actual date's column
      if (startHour >= 0 && startHour < 5 && endTotalMin > 360) {
        // Meeting starts in late-night (prev day column) and extends past 6am (current day column)
        // Add a clipped entry at hour 6 on the current day's column
        const clippedMeeting = {
          ...meeting,
          _clippedStart: '06:00:00',
          _originalStart: meeting.start_time,
        }
        const morningKey = `${startDateStr}-6`
        const morningArr = index.get(morningKey) || []
        morningArr.push(clippedMeeting)
        index.set(morningKey, morningArr)
      }
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
    // Track placements per date so habits that overlap each other can be
    // "bumped up" (shifted earlier) to end just before the already-placed
    // habit they conflict with.
    const placedHabitsByDate = new Map<string, Array<{ start: number; end: number }>>()
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

    // Sort so the longer habit at a given start time wins its natural slot
    // and shorter habits get pushed to start 15 min after it ends. Primary:
    // earliest start first. Secondary (same start): longest first.
    const habitStartMinutes = (h: any): number => {
      const t = h.current_start_time
      if (!t) return Number.POSITIVE_INFINITY
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + (mm || 0)
    }
    const orderedHabits = [...habits].sort((a, b) => {
      const diff = habitStartMinutes(a) - habitStartMinutes(b)
      if (diff !== 0) return diff
      return (b.duration || 0) - (a.duration || 0)
    })

    for (const habit of orderedHabits) {
      if (habit.habits_types?.scheduling_rule === 'non_calendar') continue

      for (const col of dayColumns) {
        const dateKey = col.dateStr
        if (habit.created_at) {
          const creationDate = new Date(habit.created_at).toLocaleDateString('en-CA')
          if (dateKey < creationDate) continue
        }

        // Weekly habits: only show on configured days, unless an explicit
        // (non-skipped) daily log overrides the pattern for that date
        if (habit.weekly_days && habit.weekly_days.length > 0) {
          const dayName = col.date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
          const matchesPattern = habit.weekly_days.includes(dayName)
          const hasOverrideLog = (habit.habits_daily_logs || []).some(
            (log: any) => log.log_date === dateKey && !log.is_skipped
          )
          if (!matchesPattern && !hasOverrideLog) continue
        }

        // Get all daily logs for this date (supports multiple blocks per day)
        const dailyLogs = (habit.habits_daily_logs || []).filter((log: any) => log.log_date === dateKey)

        // If only skipped logs exist and no unskipped blocks, skip the habit for this day
        const unskippedLogs = dailyLogs.filter((log: any) => !log.is_skipped)
        const hasSkippedLog = dailyLogs.some((log: any) => log.is_skipped)

        if (hasSkippedLog && unskippedLogs.length === 0) continue

        // If there are specific blocks, render each one
        const logsToRender = unskippedLogs.length > 0 ? unskippedLogs : [null]

        for (const dailyLog of logsToRender) {
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

        // Habit-vs-habit conflict resolution: push DOWN so the current
        // habit starts 15 minutes after the latest already-placed habit it
        // overlaps. Re-check after each shift in case the new slot still
        // collides (or collides with a different placed habit); cap
        // iterations defensively.
        const CONFLICT_BUFFER_HOURS = 0.25 // 15 minutes
        const GRID_LAST_HOUR = 29 // 5am next day (grid spans 6am → 5am)
        let finalStart = finalHour + topPosition / 100
        let finalEnd = finalStart + effectiveDuration / 60
        const placed = placedHabitsByDate.get(dateKey) || []
        for (let guard = 0; guard < 10; guard++) {
          let latestConflictEnd: number | null = null
          for (const p of placed) {
            if (finalStart < p.end && finalEnd > p.start) {
              if (latestConflictEnd === null || p.end > latestConflictEnd) {
                latestConflictEnd = p.end
              }
            }
          }
          if (latestConflictEnd === null) break
          finalStart = latestConflictEnd + CONFLICT_BUFFER_HOURS
          finalEnd = finalStart + effectiveDuration / 60
          if (finalEnd > GRID_LAST_HOUR) {
            // Nowhere left in the day — accept the overflow rather than
            // keep pushing past the end of the visible grid.
            break
          }
          isRescheduled = true
        }
        finalHour = Math.floor(finalStart)
        topPosition = (finalStart - finalHour) * 100
        placed.push({ start: finalStart, end: finalEnd })
        placedHabitsByDate.set(dateKey, placed)

        const key = `${dateKey}-${finalHour}`
        const arr = index.get(key) || []
        arr.push({ ...habit, topPosition, isRescheduled })
        index.set(key, arr)
        } // end for dailyLog of logsToRender
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
      if (hour === 5) return
      const minutes = parseInt(startTime.split(':')[1])
      const key = `${getColumnDate(dateStr, hour)}-${hour}`
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
      const key = `${getColumnDate(log.log_date, hour)}-${hour}`
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
    const generatedBuffers = generateBuffersForDays(dayColumns, meetings)
    const index = new Map<string, any[]>()
    generatedBuffers.forEach((buffer, dateStr) => {
      if (!buffer || !buffer.isActive) return
      const hour = parseInt(buffer.startTime.split(':')[0])
      if (hour === 5) return
      const minutes = parseInt(buffer.startTime.split(':')[1])
      const key = `${dateStr}-${hour}`
      index.set(key, [{ ...buffer, topPosition: (minutes / 60) * 100 }])
    })
    return index
  }, [dayColumns, meetings])

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
      .from('cassian_calendar_notes')
      .insert({ pinned_date: pinnedDate, note_id: noteId })
      .select('*, habits_notes:cassian_notes!calendar_notes_note_id_fkey(id, content, created_at)')
      .single()
    if (error) throw error
    setCalendarNotes(prev => [...prev, data])
    return data
  }

  const addHabitNote = async (content: string, noteDate: string) => {
    const { data, error } = await supabase
      .from('cassian_notes')
      .insert({ content })
      .select()
      .single()
    if (error) throw error
    setHabitNotes(prev => [data, ...prev])
    return data
  }

  const removeCalendarNote = async (calendarNoteId: string) => {
    const { error } = await supabase
      .from('cassian_calendar_notes')
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
    syncTodoist: async () => {
      if (!user) return

      // 1. Call Todoist API
      const { data: todoistData, error: fnError } = await supabase.functions.invoke('todoist', { body: { action: 'list_all' } })
      if (fnError || !todoistData?.tasks) return

      const todoistApiTasks = todoistData.tasks

      // 2. Remove excluded tasks from DB (hold_off + habit-imported labels)
      const habitImportedLabels = habits
        .flatMap((h: any) => h.todoist_filter_labels || [])
      const excludedLabels = new Set(['hold_off', ...habitImportedLabels])

      const excludedTaskIds = todoistApiTasks
        .filter((t: any) => t.labels?.some((l: string) => excludedLabels.has(l)))
        .map((t: any) => t.id)

      if (excludedTaskIds.length > 0) {
        const { data: excludedDbTasks } = await supabase
          .from('cassian_tasks')
          .select('id')
          .in('todoist_task_id', excludedTaskIds)

        if (excludedDbTasks && excludedDbTasks.length > 0) {
          const dbIds = excludedDbTasks.map((t: any) => t.id)
          await supabase.from('cassian_tasks_daily_logs').delete().in('task_id', dbIds)
          await supabase.from('cassian_tasks').delete().in('id', dbIds)
        }
      }
      const tasksForScheduling = todoistApiTasks.filter(
        (t: any) => !t.labels?.some((l: string) => excludedLabels.has(l))
      )
      await syncTodoistTasks(tasksForScheduling, user.id)

      // 4. Fetch all active todoist tasks from DB
      const { data: todoistDbTasks } = await supabase
        .from('cassian_tasks')
        .select('*')
        .eq('source', 'todoist')
        .eq('user_id', user.id)
        .eq('is_complete', false)

      if (!todoistDbTasks || todoistDbTasks.length === 0) return

      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const todoistDbIds = todoistDbTasks.map((t: any) => t.id)

      // 5. Delete ALL todoist daily logs from today onwards
      await supabase
        .from('cassian_tasks_daily_logs')
        .delete()
        .in('task_id', todoistDbIds)
        .gte('log_date', todayStr)

      // 6. Sort by priority: overdue/today > @urgent > rest
      const urgentTodoistIds = new Set(
        todoistApiTasks
          .filter((t: any) => t.labels?.includes('urgent'))
          .map((t: any) => t.id)
      )
      const urgentDbIds = new Set(
        todoistDbTasks
          .filter((t: any) => urgentTodoistIds.has(t.todoist_task_id))
          .map((t: any) => t.id)
      )

      const isUrgent = (t: any) => urgentDbIds.has(t.id)
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      const byPriority = (a: any, b: any) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)

      // 7. Schedule in priority order with date pinning
      const futureDayColumns = dayColumns.filter((col: any) => col.dateStr >= todayStr)
      // Filter out deleted todoist daily logs from conflict maps (we just wiped them)
      const nonTodoistDailyLogs = tasksDailyLogs.filter(
        (log: any) => !todoistDbIds.includes(log.task_id)
      )
      const todoistConflictMaps = computeConflictMaps(habits, sessions, meetings, futureDayColumns, nonTodoistDailyLogs)
      const weekendDayNames = settings?.weekend_days || ['saturday', 'sunday']

      const getTodoistHoursForDate = (date?: Date) => {
        if (date) {
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
          if (weekendDayNames.includes(dayName)) return TODOIST_WEEKEND_HOURS
        }
        return TODOIST_WEEKDAY_HOURS
      }

      // Schedule per-day with correct priority ordering within each day:
      // 1. Overdue/today tasks
      // 2. Tasks whose due_date matches this day
      // 3. @urgent tasks
      // 4. Remaining by priority (high > med > low)
      const overdueOrToday = todoistDbTasks
        .filter((t: any) => t.due_date && t.due_date <= todayStr && !isUrgent(t))
        .sort(byPriority)
      const urgentTasks = todoistDbTasks
        .filter((t: any) => isUrgent(t) && !(t.due_date && t.due_date <= todayStr))
        .sort(byPriority)
      const restTasks = todoistDbTasks
        .filter((t: any) => !isUrgent(t) && !(t.due_date && t.due_date <= todayStr) && !t.due_date)
        .sort(byPriority)

      // Track which tasks have been scheduled (across all days)
      const scheduledTaskIds = new Set<string>()
      let combinedResult = new Map<string, any[]>()

      for (const dayCol of futureDayColumns) {
        // Dated tasks pinned to this specific day
        const datedForThisDay = todoistDbTasks
          .filter((t: any) => t.due_date && t.due_date > todayStr && t.due_date === dayCol.dateStr)
          .sort(byPriority)

        // Build per-day priority list, skipping already-scheduled tasks
        const dayTasks = [
          ...overdueOrToday.filter(t => !scheduledTaskIds.has(t.id)),
          ...datedForThisDay.filter(t => !scheduledTaskIds.has(t.id)),
          ...urgentTasks.filter(t => !scheduledTaskIds.has(t.id)),
          ...restTasks.filter(t => !scheduledTaskIds.has(t.id)),
        ]
        if (dayTasks.length === 0) continue

        const dayResult = await scheduleAllTasks(
          dayTasks, todoistConflictMaps, [dayCol], getTodoistHoursForDate,
          scheduleTaskInAvailableSlots, saveTaskChunks,
          user.id, nonTodoistDailyLogs, [], null, dayTasks, new Map()
        )

        dayResult.forEach((tasks, dateKey) => {
          tasks.forEach((t: any) => {
            const taskId = t.id?.split('-chunk-')[0]
            if (taskId) scheduledTaskIds.add(taskId)
          })
          const existing = combinedResult.get(dateKey) || []
          combinedResult.set(dateKey, [...existing, ...tasks])
        })
      }

      const todoistScheduleResult = combinedResult
      // 8. Update UI state
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

      // 9. Re-fetch daily logs to update UI
      const { data: refreshedLogs } = await supabase
        .from('cassian_tasks_daily_logs')
        .select('*, tasks:cassian_tasks(*, projects:cassian_projects(*))')
        .eq('user_id', user.id)

      if (refreshedLogs) {
        setTasksDailyLogs(refreshedLogs)
      }
    },
    getTasksDailyLogsForTimeSlot,
    getBuffersForCalendarTimeSlot,
    getCategoryBuffersForTimeSlot,
    buffers,
    categoryBufferBlocks,
    settings,
    calendarNotes,
    habitNotes,
    setHabitNotes,
    getNotesForDateTime,
    addCalendarNote,
    addHabitNote,
    removeCalendarNote,
    skipHabitForDate: (habitId: string, date: string) => {
      setHabits(prev => prev.map(h => {
        if (h.id !== habitId) return h
        const existingLogs = h.habits_daily_logs || []
        const hasLog = existingLogs.some((log: any) => log.log_date === date)
        return {
          ...h,
          habits_daily_logs: hasLog
            ? existingLogs.map((log: any) => log.log_date === date ? { ...log, is_skipped: true } : log)
            : [...existingLogs, { habit_id: habitId, log_date: date, is_skipped: true }]
        }
      }))
    },
    linkMeetingHabit: (meetingId: string, habitId: string) => {
      setMeetings(prev => prev.map(m => {
        if (m.id !== meetingId) return m
        const existing = m.meeting_habits || []
        return { ...m, meeting_habits: [...existing, { habit_id: habitId }] }
      }))
    },
    moveHabitLog: (habitId: string, date: string, newStartTime: string) => {
      setHabits(prev => prev.map(h => {
        if (h.id !== habitId) return h
        const logs = h.habits_daily_logs || []
        const hasLog = logs.some((log: any) => log.log_date === date && !log.is_skipped)
        if (hasLog) {
          return {
            ...h,
            habits_daily_logs: logs.map((log: any) =>
              log.log_date === date && !log.is_skipped ? { ...log, scheduled_start_time: newStartTime } : log
            )
          }
        }
        // No existing log — add one
        return {
          ...h,
          habits_daily_logs: [...logs, { habit_id: habitId, log_date: date, scheduled_start_time: newStartTime, is_skipped: false, duration: h.duration }]
        }
      }))
    },
    updateHabitLogDuration: (habitId: string, date: string, duration: number) => {
      setHabits(prev => prev.map(h => {
        if (h.id !== habitId) return h
        const logs = (h.habits_daily_logs || []).map((log: any) =>
          log.log_date === date && !log.is_skipped ? { ...log, duration } : log
        )
        return { ...h, habits_daily_logs: logs }
      }))
    },
    addHabitBlock: (habitId: string, date: string, startTime: string, duration: number) => {
      setHabits(prev => prev.map(h => {
        if (h.id !== habitId) return h
        // Remove skipped logs for this date, add new block
        const existingLogs = (h.habits_daily_logs || []).filter(
          (log: any) => !(log.log_date === date && log.is_skipped)
        )
        return {
          ...h,
          habits_daily_logs: [
            ...existingLogs,
            { habit_id: habitId, log_date: date, scheduled_start_time: startTime, duration, is_skipped: false, is_completed: false }
          ]
        }
      }))
    },
    removeTaskLogFromUI: (logId: string) => {
      setTasksDailyLogs(prev => prev.filter(log => log.id !== logId))
    },
    moveTaskLog: (logId: string, newStartTime: string, newEndTime: string) => {
      setTasksDailyLogs(prev => prev.map(log =>
        log.id === logId ? { ...log, scheduled_start_time: newStartTime, scheduled_end_time: newEndTime } : log
      ))
    },
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
