import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Info, FileText, RefreshCw, Settings as SettingsIcon } from 'lucide-react'
import CalendarSettingsPanel from '../components/CalendarSettingsPanel'
import NoteModal from '../components/NoteModal'
import { useCalendarData } from '../hooks/useCalendarData'
import { supabase } from '../lib/supabase'
import { Meeting } from '../types'
import { deltaYToMinutes, computeMovedTimes } from '../utils/calendarDragUtils'
import { getEffectiveHabitStartTime } from '../utils/habitScheduling'
import TaskScheduleModal from '../components/TaskScheduleModal'
import {
  handleHabitTimeChange,
  handleHabitSkip,
  handleCompleteTask,
  handleDeleteTask,
} from '../utils/calendarDatabaseOperations'
import { calculateWorkHours } from '../utils/workHoursCalculation'
import { ModalProvider, useModal } from '../contexts/ModalContext'
import { useUserContext } from '../contexts/UserContext'
import CalendarEventSlots from '../components/CalendarEventSlots'
import CalendarTopBar from '../components/CalendarTopBar'
import CalendarGrid, { getQuarterFromMousePosition, quarterToTimeString } from '../components/CalendarGrid'

interface CalendarContentProps {
  handlersRef: React.MutableRefObject<Record<string, Function>>
  onMeetingTitlesLoaded: (titles: { title: string; count: number; lastUsed: Date }[]) => void
  onMeetingCategoriesLoaded: (categories: { id: string; name: string; color: string }[]) => void
  onHabitsLoaded: (habits: any[]) => void
}

const CalendarContent = ({ handlersRef, onMeetingTitlesLoaded, onMeetingCategoriesLoaded, onHabitsLoaded }: CalendarContentProps) => {

  const { openMeetingModal, openHabitModal, openTaskModal, openSessionModal, closeAllModals, openResizeConflictDialog, selectedTimeSlot: modalTimeSlot } = useModal()
  const { user } = useUserContext()
  const { setMobileMenuOpen } = useOutletContext<{ setMobileMenuOpen: (open: boolean) => void }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showActualHoursTooltip, setShowActualHoursTooltip] = useState(false)
  const [showPlannedHoursTooltip, setShowPlannedHoursTooltip] = useState(false)
  const [showWorkHoursTooltip, setShowWorkHoursTooltip] = useState(false)
  const [showTaskScheduleModal, setShowTaskScheduleModal] = useState(false)

  // Note view modal state
  const [viewingNote, setViewingNote] = useState<any>(null)
  const [isSyncingTodoist, setIsSyncingTodoist] = useState(false)
  const [showCalendarSettings, setShowCalendarSettings] = useState(false)

  const [meetingDataLoaded, setMeetingDataLoaded] = useState(false)


  // Handle Google Calendar OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_callback') === 'true' && params.get('code')) {
      const code = params.get('code')!
      const handleCallback = async () => {
        await supabase.functions.invoke('google-calendar', {
          body: {
            action: 'callback',
            code,
            redirectUri: window.location.origin + '/calendar?google_callback=true',
          },
        })
        // Clean URL and sync
        window.history.replaceState({}, '', '/calendar')
        await syncGoogleCalendar()
      }
      handleCallback()
    }
  }, [])

  // Sync Google Calendar events
  const syncGoogleCalendar = async () => {
    const { data } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'list_calendars' },
    })
    const calendars = data?.calendars || []
    const enabledCalendars = calendars.filter((c: any) => c.is_enabled)
    for (const cal of enabledCalendars) {
      await supabase.functions.invoke('google-calendar', {
        body: { action: 'sync_events', userCalendarId: cal.id },
      })
    }
    // Refresh calendar data by reloading
    window.location.reload()
  }

  // Pre-fetch meeting modal data on calendar mount
  useEffect(() => {
    if (!user || meetingDataLoaded) return
    const fetchMeetingData = async () => {
      const [titlesRes, categoriesRes] = await Promise.all([
        supabase.rpc('get_recent_meeting_titles', { p_user_id: user.id, p_limit: 20 }),
        supabase.from('cassian_meeting_categories').select('id, name, color').eq('user_id', user.id).order('name'),
      ])
      if (titlesRes.data) {
        onMeetingTitlesLoaded(titlesRes.data.map((row: any) => ({ title: row.title, count: row.count, lastUsed: new Date(row.last_used) })))
      }
      if (categoriesRes.data) {
        onMeetingCategoriesLoaded(categoriesRes.data)
      }
      setMeetingDataLoaded(true)
    }
    fetchMeetingData()
  }, [user])

  // Calendar notes come from useCalendarData (merged into single fetch)

  // Meeting resize state
  const [resizingMeeting, setResizingMeeting] = useState<any>(null)
  const [resizeNewEndTime, setResizeNewEndTime] = useState<Date | null>(null)
  const resizeStartYRef = useRef<number>(0)
  const resizeStartEndTimeRef = useRef<Date | null>(null)

  // Task log drag state
  const [draggingTaskLog, setDraggingTaskLog] = useState<any>(null)
  const [taskLogDragY, setTaskLogDragY] = useState<number>(0)
  const taskLogDragStartYRef = useRef<number>(0)
  const taskLogOriginalStartRef = useRef<string>('')

  // Habit resize state
  const [resizingHabit, setResizingHabit] = useState<any>(null)
  const [resizingHabitDate, setResizingHabitDate] = useState<Date | null>(null)
  const [resizeHabitNewDuration, setResizeHabitNewDuration] = useState<number>(0)
  const habitResizeStartYRef = useRef<number>(0)
  const habitResizeOriginalDurationRef = useRef<number>(0)

  // Habit drag state
  const [draggingHabit, setDraggingHabit] = useState<any>(null)
  const [draggingHabitDate, setDraggingHabitDate] = useState<Date | null>(null)
  const [habitDragY, setHabitDragY] = useState<number>(0)
  const habitDragStartYRef = useRef<number>(0)
  const habitOriginalStartRef = useRef<string>('')

  // Drag-to-create meeting state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{
    time: string
    date: Date
    hourIndex: number
    columnIndex: number
    quarter: number
  } | null>(null)
  const [dragEnd, setDragEnd] = useState<{
    time: string
    date: Date
    hourIndex: number
    columnIndex: number
    quarter: number
  } | null>(null)

  // Initialize baseDate from URL parameter or current date
  const getInitialDate = () => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // Parse as local date to avoid timezone issues
      const [year, month, day] = dateParam.split('-').map(Number)
      if (year && month && day) {
        const parsedDate = new Date(year, month - 1, day) // month is 0-indexed
        // Validate the date
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate
        }
      }
    }
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    return twoDaysAgo
  }

  const [baseDate, setBaseDate] = useState(getInitialDate)

  const {
    allTasks,
    dayColumns,
    hourSlots,
    getCurrentTimeLinePosition,
    habits,
    meetings,
    tasksDailyLogs,
    getTasksForTimeSlot,
    getMeetingsForTimeSlot,
    getHabitsForTimeSlot,
    getSessionsForTimeSlot,
    getTasksDailyLogsForTimeSlot,
    getBuffersForCalendarTimeSlot,
    getCategoryBuffersForTimeSlot,
    settings,
    tasksScheduled,
    scheduledTasksCache,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    isDataLoading,
    calendarNotes,
    habitNotes,
    getNotesForDateTime,
    addCalendarNote,
    addHabitNote,
    removeCalendarNote,
    removeTaskFromCalendar,
    removeTaskLogFromUI,
    moveTaskLog,
    skipHabitForDate,
    addHabitBlock,
    updateHabitLogDuration,
    moveHabitLog,
    linkMeetingHabit,
    syncTodoist,
  } = useCalendarData(windowWidth, baseDate)

  // Calendar data already includes habits - no need for separate useHabits hook

  // Propagate habits data to parent for meeting modal
  useEffect(() => {
    onHabitsLoaded(habits)
  }, [habits])

  const gridCols =
    windowWidth > 1350
      ? '80px 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
      : windowWidth > 600
      ? '80px 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
      : '60px 1fr'

  // Navigation functions
  const navigateBackWeek = () => {
    const newDate = new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  const navigateBackDay = () => {
    const newDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  const navigateForwardDay = () => {
    const newDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  const navigateToToday = () => {
    const today = new Date()
    setBaseDate(today)
    setSearchParams({ date: format(today, 'yyyy-MM-dd') })
  }

  const navigateForwardWeek = () => {
    const newDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    setBaseDate(newDate)
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') })
  }

  // Listen for URL parameter changes
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      // Parse as local date to avoid timezone issues
      const [year, month, day] = dateParam.split('-').map(Number)
      if (year && month && day) {
        const parsedDate = new Date(year, month - 1, day) // month is 0-indexed
        if (!isNaN(parsedDate.getTime())) {
          setBaseDate(parsedDate)
        }
      }
    }
  }, [searchParams])

  // Listen for window resize and container height changes
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    handleResize() // Initial call
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Update container height and scroll to 3 hours before now
  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight)
      const now = new Date()
      const currentHour = now.getHours()
      // Grid: 6-23 = index 0-17, 0-4 = index 18-22
      const isLateNight = currentHour >= 0 && currentHour < 5
      const currentIndex = isLateNight ? (currentHour + 18) : (currentHour - 6)
      const scrollIndex = Math.max(0, currentIndex - 3)
      containerRef.current.scrollTop = scrollIndex * 64
    }
  }, [])

  // Hours 0-4 on a column visually belong to the next calendar day
  const adjustDateForLateNight = (time: string, columnDate: Date): Date => {
    const hour = parseInt(time.split(':')[0])
    if (hour >= 0 && hour < 5) {
      const nextDay = new Date(columnDate)
      nextDay.setDate(nextDay.getDate() + 1)
      return nextDay
    }
    return columnDate
  }

  const dragOccurredRef = useRef(false)
  const handleTimeSlotClick = (event: React.MouseEvent, timeSlot: string, date: Date) => {
    // Skip if a drag just completed (the drag handler already opened the modal)
    if (dragOccurredRef.current) {
      dragOccurredRef.current = false
      return
    }
    // Check if the click originated from a calendar event
    const target = event.target as HTMLElement
    if (target.closest('[data-calendar-event]')) {
      return // Don't open meeting modal if clicking on a calendar event
    }
    // Calculate the quarter-hour from click position
    const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
    const [hour] = timeSlot.split(':')
    const minutes = quarter * 15
    const precisetime = `${hour}:${minutes.toString().padStart(2, '0')}`
    openMeetingModal({ time: precisetime, date: adjustDateForLateNight(precisetime, date) })
  }

  const handleAddMeeting = () => {
    openMeetingModal()
  }

  const handleEditMeeting = useCallback((meeting: Meeting) => {
    if (meetingResizedRef.current) {
      meetingResizedRef.current = false
      return
    }
    openMeetingModal(undefined, meeting)
  }, [openMeetingModal])

  const handleTimeSlotContextMenu = (event: React.MouseEvent, timeSlot: string, date: Date) => {
    event.preventDefault()
  }

  const handleSaveMeeting = async (
    e: React.FormEvent,
    updatedMeeting: any,
    editingMeeting?: Meeting
  ) => {
    e.preventDefault()
    try {
      let startTime: Date, endTime: Date

      // Handle both ISO string format and time string format (or mixed formats)
      if (updatedMeeting.start_time.includes('T') || updatedMeeting.end_time.includes('T')) {
        // ISO string format from MeetingModal (or mixed format for cross-midnight meetings)
        
        // Handle start_time
        if (updatedMeeting.start_time.includes('T')) {
          startTime = new Date(updatedMeeting.start_time)
        } else {
          // Parse time string and create full date
          const [startHour, startMinute] = updatedMeeting.start_time.split(':').map(Number)
          const [year, month, day] = updatedMeeting.date.split('-').map(Number)
          startTime = new Date(year, month - 1, day, startHour, startMinute)
        }
        
        // Handle end_time
        if (updatedMeeting.end_time.includes('T')) {
          endTime = new Date(updatedMeeting.end_time)
        } else {
          // Parse time string and create full date
          const [endHour, endMinute] = updatedMeeting.end_time.split(':').map(Number)
          const [year, month, day] = updatedMeeting.date.split('-').map(Number)
          endTime = new Date(year, month - 1, day, endHour, endMinute)
          
          // Handle cross-midnight case for time strings
          if (endTime <= startTime) {
            endTime = new Date(year, month - 1, day + 1, endHour, endMinute)
          }
        }
        
        // Validate dates
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          throw new Error('Invalid date/time values from modal')
        }
      } else {
        // Legacy time string format
        const [year, month, day] = updatedMeeting.date.split('-').map(Number)
        const [startHour, startMinute] = updatedMeeting.start_time.split(':').map(Number)
        const [endHour, endMinute] = updatedMeeting.end_time.split(':').map(Number)

        // Validate parsed values
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
          throw new Error('Invalid date/time parsing from legacy format')
        }

        // Create dates in local timezone (not UTC)
        startTime = new Date(year, month - 1, day, startHour, startMinute)
        endTime = new Date(year, month - 1, day, endHour, endMinute)
        
        // Handle cross-midnight meetings: if end time is earlier than start time, it's the next day
        if (endTime <= startTime) {
          endTime = new Date(year, month - 1, day + 1, endHour, endMinute)
        }
        
        // Validate created dates
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          throw new Error('Invalid dates created from legacy format')
        }
      }

      const meetingData = {
        title: updatedMeeting.title,
        description: updatedMeeting.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: updatedMeeting.location,
        meeting_type: updatedMeeting.meeting_type,
        priority: updatedMeeting.priority,
        category_id: updatedMeeting.category_id || null,
        status: 'scheduled' as const,
      }

      if (editingMeeting) {
        await updateMeeting(editingMeeting.id, meetingData)
      } else {
        await addMeeting(meetingData)
      }

      // Delete overlapping task daily logs
      const meetingDateStr = format(startTime, 'yyyy-MM-dd')
      const meetingStartH = startTime.getHours() + startTime.getMinutes() / 60
      const meetingEndH = endTime.getHours() + endTime.getMinutes() / 60
      const overlapping = tasksDailyLogs.filter((log: any) => {
        if (log.log_date !== meetingDateStr) return false
        const logTime = log.actual_start_time || log.scheduled_start_time
        if (!logTime) return false
        const logStartH = parseInt(logTime.split(':')[0]) + parseInt(logTime.split(':')[1]) / 60
        const logEndH = logStartH + (log.estimated_hours || 0.5)
        return logStartH < meetingEndH && logEndH > meetingStartH
      })
      if (overlapping.length > 0) {
        for (const log of overlapping) {
          await supabase.from('cassian_tasks_daily_logs').delete().eq('id', log.id)
          removeTaskLogFromUI(log.id)
        }
      }

      // Modal cleanup handled by ModalContext's closeMeetingModal()
    } catch (error) {
      console.error('Error saving meeting:', error)
    }
  }

  const handleDeleteMeeting = async (meeting: Meeting) => {
    try {
      await deleteMeeting(meeting.id)
      // Modal will be closed by the context
    } catch (error) {
      console.error('Error deleting meeting:', error)
    }
  }

  const handleTaskClick = useCallback((task: any) => {
    openTaskModal(task)
  }, [openTaskModal])

  const handleHabitClick = useCallback((habit: any, date: Date) => {
    openHabitModal(habit, date)
  }, [openHabitModal])

  const handleSessionClick = useCallback((session: any) => {
    openSessionModal(session)
  }, [openSessionModal])

  const handleHabitTimeChangeWithReset = async (
    habitId: string,
    date: string,
    newTime: string,
    newDuration?: number
  ) => {
    try {
      await handleHabitTimeChange(habitId, date, newTime, newDuration)
      // Task scheduling will be automatically regenerated by useCalendarData hook
    } catch (error) {
      console.error('Error updating habit:', error)
      throw error
    }
  }

  const handleHabitSkipWithReset = async (habitId: string, date: string) => {
    try {
      await handleHabitSkip(habitId, date)
      skipHabitForDate(habitId, date)
    } catch (error) {
      console.error('Error skipping habit:', error)
      throw error
    }
  }

  const closeModal = () => {
    closeAllModals()
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }


  // Drag handlers for creating meetings
  const handleMouseDown = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
    // Don't start drag if another drag/resize is active or clicking on a calendar event
    if (resizingMeeting || draggingTaskLog || draggingHabit) return
    const target = event.target as HTMLElement
    if (target.closest('[data-calendar-event]')) return
    
    const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
    setIsDragging(true)
    setDragStart({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
  }

  const handleMouseEnter = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
    if (isDragging && dragStart && columnIndex === dragStart.columnIndex) {
      const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
      setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    }
  }

  const handleMouseMove = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
    if (isDragging && dragStart && columnIndex === dragStart.columnIndex) {
      const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
      setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    }
  }

  const handleMouseUp = (
    event?: React.MouseEvent,
    timeSlot?: string,
    date?: Date,
    hourIndex?: number,
    columnIndex?: number
  ) => {
    if (event) mouseHandledRef.current = true

    
    // Don't process drag-to-create if another event drag just finished
    if (eventDragActiveRef.current) {
      eventDragActiveRef.current = false
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
      return
    }

    if (isDragging && dragStart) {
      // Force update dragEnd to the mouse up position if we have it
      let finalDragEnd = dragEnd
      if (event && timeSlot && date && hourIndex !== undefined && columnIndex !== undefined) {
        const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
        finalDragEnd = { time: timeSlot, date, hourIndex, columnIndex, quarter }
      }

      if (finalDragEnd) {
        // Use the same calculation logic as the drag overlay
        const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
        const endTotalQuarters = finalDragEnd.hourIndex * 4 + finalDragEnd.quarter
        const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
        const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters)

        const startHourIndex = Math.floor(minQuarters / 4)
        const startQuarter = minQuarters % 4
        // End time is the END of the last selected quarter (add 1)
        const endPlusOne = maxQuarters + 1
        const endHourIndex = Math.floor(endPlusOne / 4)
        const endQuarter = endPlusOne % 4

        const startTime = quarterToTimeString(startHourIndex, startQuarter, hourSlots)
        const endTime = quarterToTimeString(endHourIndex, endQuarter, hourSlots)

        // Only open modal if we have a valid drag (not just a click)
        if (startTotalQuarters !== endTotalQuarters) {
          dragOccurredRef.current = true
          openMeetingModal({ time: startTime, date: adjustDateForLateNight(startTime, dragStart.date), endTime: endTime })
        }
      }
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Add global mouse up listener to handle mouse up outside the calendar
  const mouseHandledRef = useRef(false)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging && !mouseHandledRef.current) {
        handleMouseUp()
      }
      mouseHandledRef.current = false
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragging, dragStart, dragEnd])

  // Helper function to check if a time slot is within the drag selection
  const isInDragSelection = (hourIndex: number, columnIndex: number, quarter?: number) => {
    if (!isDragging || !dragStart || !dragEnd || columnIndex !== dragStart.columnIndex) {
      return false
    }

    const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
    const endTotalQuarters = dragEnd.hourIndex * 4 + dragEnd.quarter

    const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
    const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters)

    if (quarter !== undefined) {
      // Check specific quarter
      const currentQuarters = hourIndex * 4 + quarter
      return currentQuarters >= minQuarters && currentQuarters <= maxQuarters
    } else {
      // Check if any part of the hour overlaps with selection
      const hourStartQuarters = hourIndex * 4
      const hourEndQuarters = hourIndex * 4 + 3

      return !(hourEndQuarters < minQuarters || hourStartQuarters > maxQuarters)
    }
  }

  // Close tooltips when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showActualHoursTooltip && !(event.target as Element).closest('.actual-hours-tooltip')) {
        setShowActualHoursTooltip(false)
      }
      if (showPlannedHoursTooltip && !(event.target as Element).closest('.planned-hours-tooltip')) {
        setShowPlannedHoursTooltip(false)
      }
      if (showWorkHoursTooltip && !(event.target as Element).closest('.work-hours-tooltip')) {
        setShowWorkHoursTooltip(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActualHoursTooltip, showPlannedHoursTooltip, showWorkHoursTooltip])


  // Meeting resize handlers
  const meetingResizedRef = useRef(false)
  const eventDragActiveRef = useRef(false)
  const handleMeetingResizeStart = useCallback((meeting: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    meetingResizedRef.current = true
    eventDragActiveRef.current = true
    setResizingMeeting(meeting)
    resizeStartYRef.current = e.clientY
    resizeStartEndTimeRef.current = new Date(meeting.end_time)
    setResizeNewEndTime(new Date(meeting.end_time))
  }, [])

  useEffect(() => {
    if (!resizingMeeting) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartYRef.current
      const deltaMinutes = deltaYToMinutes(deltaY)
      const newEnd = new Date(resizeStartEndTimeRef.current!.getTime() + deltaMinutes * 60000)
      const meetingStart = new Date(resizingMeeting.start_time)
      // Minimum 15 minutes
      if (newEnd.getTime() - meetingStart.getTime() >= 15 * 60000) {
        setResizeNewEndTime(newEnd)
      }
    }

    const handleMouseUp = async () => {
      if (!resizeNewEndTime || !resizingMeeting) {
        setResizingMeeting(null)
        return
      }

      const originalEnd = new Date(resizingMeeting.end_time)
      if (resizeNewEndTime.getTime() === originalEnd.getTime()) {
        setResizingMeeting(null)
        return
      }

      // Check for overlapping tasks in the extended range
      const meetingDate = format(new Date(resizingMeeting.start_time), 'yyyy-MM-dd')
      const newEndHours = resizeNewEndTime.getHours() + resizeNewEndTime.getMinutes() / 60
      const origEndHours = originalEnd.getHours() + originalEnd.getMinutes() / 60

      // Only check for conflicts if we're extending (not shrinking)
      if (newEndHours > origEndHours) {
        const conflicting = tasksDailyLogs.filter((log: any) => {
          if (log.log_date !== meetingDate) return false
          const startTime = log.actual_start_time || log.scheduled_start_time
          if (!startTime) return false
          const logStartH = parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60
          const logEndH = logStartH + (log.estimated_hours || 0.5)
          return logStartH < newEndHours && logEndH > origEndHours
        })

        if (conflicting.length > 0) {
          openResizeConflictDialog(resizingMeeting, resizeNewEndTime, conflicting)
          setResizingMeeting(null)
          setResizeNewEndTime(null)
          return
        }
      }

      // No conflicts — just update
      await updateMeeting(resizingMeeting.id, { end_time: resizeNewEndTime.toISOString() })
      setResizingMeeting(null)
      setResizeNewEndTime(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingMeeting, resizeNewEndTime, tasksDailyLogs, updateMeeting])

  // Habit resize
  const handleHabitResizeStart = useCallback((habit: any, date: Date, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    const dateStr = format(date, 'yyyy-MM-dd')
    const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateStr && !log.is_skipped)
    const duration = dailyLog?.duration || habit.duration || 60
    setResizingHabit(habit)
    setResizingHabitDate(date)
    habitResizeStartYRef.current = e.clientY
    habitResizeOriginalDurationRef.current = duration
    setResizeHabitNewDuration(duration)
  }, [])

  useEffect(() => {
    if (!resizingHabit || !resizingHabitDate) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaMinutes = deltaYToMinutes(e.clientY - habitResizeStartYRef.current)
      const newDuration = Math.max(15, habitResizeOriginalDurationRef.current + deltaMinutes)
      setResizeHabitNewDuration(newDuration)
    }

    const handleMouseUp = async () => {
      const dateStr = format(resizingHabitDate, 'yyyy-MM-dd')
      const originalDuration = habitResizeOriginalDurationRef.current

      if (resizeHabitNewDuration !== originalDuration) {
        // Find the daily log to update
        const dailyLog = resizingHabit.habits_daily_logs?.find(
          (log: any) => log.log_date === dateStr && !log.is_skipped
        )

        if (dailyLog?.id) {
          await supabase
            .from('cassian_habits_daily_logs')
            .update({ duration: resizeHabitNewDuration })
            .eq('id', dailyLog.id)
        } else {
          // No existing log — update via time change
          await handleHabitTimeChangeWithReset(
            resizingHabit.id, dateStr,
            getEffectiveHabitStartTime(resizingHabit, dateStr) || resizingHabit.current_start_time,
            resizeHabitNewDuration
          )
        }

        updateHabitLogDuration(resizingHabit.id, dateStr, resizeHabitNewDuration)
      }

      setResizingHabit(null)
      setResizingHabitDate(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingHabit, resizingHabitDate, resizeHabitNewDuration])

  // Task log drag-to-move
  const handleTaskLogDragStart = useCallback((log: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    setDraggingTaskLog(log)
    taskLogDragStartYRef.current = e.clientY
    taskLogOriginalStartRef.current = log.scheduled_start_time
    setTaskLogDragY(0)
  }, [])

  useEffect(() => {
    if (!draggingTaskLog) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - taskLogDragStartYRef.current
      setTaskLogDragY(deltaY)
    }

    const handleMouseUp = async () => {
      if (!draggingTaskLog) return

      const result = computeMovedTimes(
        taskLogOriginalStartRef.current,
        draggingTaskLog.estimated_hours || 0.5,
        taskLogDragY
      )

      if (!result) {
        setDraggingTaskLog(null)
        setTaskLogDragY(0)
        return
      }

      // Check if the new end time is before now (moved into the past = complete)
      const now = new Date()
      const [endH, endM] = result.newEndTime.split(':').map(Number)
      const endDate = new Date(draggingTaskLog.log_date + 'T00:00:00')
      endDate.setHours(endH, endM, 0, 0)
      const isBeforeNow = endDate < now

      if (isBeforeNow && draggingTaskLog.tasks?.source === 'todoist' && draggingTaskLog.tasks?.todoist_task_id) {
        // Complete in Todoist
        await supabase.functions.invoke('todoist', {
          body: { action: 'complete', taskId: draggingTaskLog.tasks.todoist_task_id }
        })
        // Mark complete in DB
        await supabase.from('cassian_tasks').update({ is_complete: true, status: 'completed' }).eq('id', draggingTaskLog.task_id)
      } else if (isBeforeNow) {
        // Non-todoist task: mark complete
        await supabase.from('cassian_tasks').update({ is_complete: true, status: 'completed' }).eq('id', draggingTaskLog.task_id)
      }

      // Always move to the new position
      await supabase
        .from('cassian_tasks_daily_logs')
        .update({ scheduled_start_time: result.newStartTime, scheduled_end_time: result.newEndTime })
        .eq('id', draggingTaskLog.id)
      moveTaskLog(draggingTaskLog.id, result.newStartTime, result.newEndTime)

      setDraggingTaskLog(null)
      setTaskLogDragY(0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingTaskLog, taskLogDragY])

  // Habit drag-to-move
  const handleHabitDragStart = useCallback((habit: any, date: Date, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    eventDragActiveRef.current = true
    const dateStr = format(date, 'yyyy-MM-dd')
    const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateStr)
    const startTime = getEffectiveHabitStartTime(habit, dateStr, dailyLog)
    setDraggingHabit(habit)
    setDraggingHabitDate(date)
    habitDragStartYRef.current = e.clientY
    habitOriginalStartRef.current = startTime || '06:00'
    setHabitDragY(0)
  }, [])

  useEffect(() => {
    if (!draggingHabit || !draggingHabitDate) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - habitDragStartYRef.current
      setHabitDragY(deltaY)
    }

    const handleMouseUp = async () => {
      if (!draggingHabit || !draggingHabitDate) return

      const dateStr = format(draggingHabitDate, 'yyyy-MM-dd')
      const durationHours = (draggingHabit.duration || 60) / 60
      const result = computeMovedTimes(habitOriginalStartRef.current, durationHours, habitDragY)

      if (!result) {
        setDraggingHabit(null)
        setHabitDragY(0)
        return
      }

      const newStartH = parseInt(result.newStartTime.split(':')[0])
      const newStartM = parseInt(result.newStartTime.split(':')[1])
      const newTimeStr = `${newStartH.toString().padStart(2, '0')}:${newStartM.toString().padStart(2, '0')}`
      const newEndH = parseInt(result.newEndTime.split(':')[0]) + parseInt(result.newEndTime.split(':')[1]) / 60
      const newStartHours = newStartH + newStartM / 60

      // Skip overlapping habits
      const overlappingHabits = habits.filter((h: any) => {
        if (h.id === draggingHabit.id) return false
        const hLog = h.habits_daily_logs?.find((log: any) => log.log_date === dateStr)
        if (hLog?.is_skipped) return false
        const hStart = hLog?.start_time || h.start_time || '06:00'
        const hStartH = parseInt(hStart.split(':')[0]) + parseInt(hStart.split(':')[1]) / 60
        const hDuration = (hLog?.duration || h.duration || 60) / 60
        const hEndH = hStartH + hDuration
        return hStartH < newEndH && hEndH > newStartHours
      })

      for (const h of overlappingHabits) {
        await handleHabitSkipWithReset(h.id, dateStr)
      }

      // Delete overlapping task daily logs
      const overlappingLogs = tasksDailyLogs.filter((log: any) => {
        if (log.log_date !== dateStr) return false
        const logTime = log.actual_start_time || log.scheduled_start_time
        if (!logTime) return false
        const logStartH = parseInt(logTime.split(':')[0]) + parseInt(logTime.split(':')[1]) / 60
        const logEndH = logStartH + (log.estimated_hours || 0.5)
        return logStartH < newEndH && logEndH > newStartHours
      })

      for (const log of overlappingLogs) {
        await supabase.from('cassian_tasks_daily_logs').delete().eq('id', log.id)
        removeTaskLogFromUI(log.id)
      }

      // Update the habit's time — find existing log and update by ID to avoid duplicates
      const existingLog = draggingHabit.habits_daily_logs?.find(
        (log: any) => log.log_date === dateStr && !log.is_skipped
      )
      if (existingLog?.id) {
        await supabase
          .from('cassian_habits_daily_logs')
          .update({ scheduled_start_time: `${newTimeStr}:00` })
          .eq('id', existingLog.id)
      } else {
        await handleHabitTimeChangeWithReset(draggingHabit.id, dateStr, newTimeStr)
      }

      // Update local state
      moveHabitLog(draggingHabit.id, dateStr, `${newTimeStr}:00`)

      setDraggingHabit(null)
      setHabitDragY(0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingHabit, draggingHabitDate, habitDragY, habits, tasksDailyLogs])

  // Render all calendar events for a time slot
  const renderCalendarEvents = useCallback(
    (timeSlot: string, date: Date) => {
      if (isDataLoading) return null

      const dateStr = format(date, 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      const isToday = dateStr === today
      const isFuture = dateStr > today
      const isPast = dateStr < today

      const habitsInSlot = getHabitsForTimeSlot(timeSlot, date)
      const sessionsInSlot = getSessionsForTimeSlot(timeSlot, date)
      const meetingsInSlot = getMeetingsForTimeSlot(timeSlot, date)
      const buffersInSlot = getBuffersForCalendarTimeSlot(timeSlot, date)
      const categoryBuffersInSlot = getCategoryBuffersForTimeSlot(timeSlot, date)
      // Tasks render from tasks_daily_logs (single source of truth)
      const tasksInSlot: any[] = []
      const tasksDailyLogsInSlot = getTasksDailyLogsForTimeSlot(timeSlot, date)

      const baseItemHeight = 32 // Base height for calculating offsets

      return (
        <CalendarEventSlots
          habitsInSlot={habitsInSlot}
          sessionsInSlot={sessionsInSlot}
          meetingsInSlot={meetingsInSlot}
          buffersInSlot={buffersInSlot}
          tasksInSlot={tasksInSlot}
          tasksDailyLogsInSlot={tasksDailyLogsInSlot}
          categoryBuffersInSlot={categoryBuffersInSlot}
          timeSlot={timeSlot}
          date={date}
          dateStr={dateStr}
          baseItemHeight={baseItemHeight}
          handleHabitClick={handleHabitClick}
          handleSessionClick={handleSessionClick}
          handleTaskClick={handleTaskClick}
          handleEditMeeting={handleEditMeeting}
          onMeetingResizeStart={handleMeetingResizeStart}
          onTaskLogDragStart={handleTaskLogDragStart}
          draggingTaskLogId={draggingTaskLog?.id}
          taskLogDragY={taskLogDragY}
          onHabitDragStart={handleHabitDragStart}
          onHabitResizeStart={handleHabitResizeStart}
          draggingHabitId={draggingHabit?.id}
          draggingHabitDateStr={draggingHabitDate ? format(draggingHabitDate, 'yyyy-MM-dd') : null}
          habitDragY={habitDragY}
        />
      )
    },
    [
      getHabitsForTimeSlot,
      getSessionsForTimeSlot,
      getMeetingsForTimeSlot,
      getTasksForTimeSlot,
      getTasksDailyLogsForTimeSlot,
      getBuffersForCalendarTimeSlot,
      getCategoryBuffersForTimeSlot,
      isDataLoading,
      tasksScheduled,
      handleHabitClick,
      handleSessionClick,
      handleTaskClick,
      handleEditMeeting,
      handleTaskLogDragStart,
      draggingTaskLog,
      taskLogDragY,
      handleHabitDragStart,
      handleHabitResizeStart,
      draggingHabit,
      habitDragY,
    ]
  )

  // Pre-index habit notes by date-hour for note badges
  const noteBadgesIndex = useMemo(() => {
    const index = new Map<string, any[]>()
    habitNotes.forEach((note: any) => {
      const noteTime = new Date(note.start_time || note.created_at)
      const dateStr = format(noteTime, 'yyyy-MM-dd')
      const hour = noteTime.getHours()
      const key = `${dateStr}-${hour}`
      const arr = index.get(key) || []
      arr.push({ ...note, minuteInHour: noteTime.getMinutes() })
      index.set(key, arr)
    })
    return index
  }, [habitNotes])

  const renderNoteBadges = useCallback(
    (timeSlot: string, date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const hour = parseInt(timeSlot.split(':')[0])
      const key = `${dateStr}-${hour}`
      const notes = noteBadgesIndex.get(key)
      if (!notes || notes.length === 0) return null

      return notes.map((note: any) => {
        const topPercent = (note.minuteInHour / 60) * 100
        return (
          <div
            key={`note-badge-${note.id}`}
            className="absolute left-0 z-30 cursor-pointer"
            style={{ top: `${topPercent}%` }}
            onClick={e => {
              e.stopPropagation()
              setViewingNote(note)
            }}
            title={note.title || note.content?.slice(0, 50)}
          >
            <div className="w-[20px] h-[20px] p-[2px] bg-amber-400 hover:bg-amber-300 rounded-full flex items-center justify-center shadow-sm border border-amber-500 -translate-x-1/2">
              <FileText className="w-full h-full text-amber-900" />
            </div>
          </div>
        )
      })
    },
    [noteBadgesIndex]
  )

  const { plannedHours, actualHours, actualHoursBreakdown, plannedHoursBreakdown } = useMemo(
    () =>
      calculateWorkHours(scheduledTasksCache, allTasks, tasksScheduled, settings, tasksDailyLogs),
    [scheduledTasksCache, allTasks, tasksScheduled, settings, tasksDailyLogs]
  )

  // Set the handlers for the modal provider
  useEffect(() => {
    handlersRef.current = {
      saveMeeting: handleSaveMeeting,
      deleteMeeting: handleDeleteMeeting,
      habitTimeChange: handleHabitTimeChangeWithReset,
      habitSkip: handleHabitSkipWithReset,
      removeTask: removeTaskFromCalendar,
      removeTaskLog: removeTaskLogFromUI,
      updateMeetingEndTime: async (meetingId: string, newEndTime: string) => {
        await updateMeeting(meetingId, { end_time: newEndTime })
      },
      addHabitBlock,
      linkMeetingHabit,
      addNote: () => {
        if (modalTimeSlot) {
          const [hour, minute] = modalTimeSlot.time.split(':').map(Number)
          const noteDate = new Date(modalTimeSlot.date)
          noteDate.setHours(hour, minute, 0, 0)
          setViewingNote({
            id: null,
            title: '',
            content: '',
            start_time: noteDate.toISOString(),
            created_at: noteDate.toISOString(),
            _isNew: true,
          })
        }
      },
    }
  }, [handleSaveMeeting, handleDeleteMeeting, modalTimeSlot])

  return (
    <div className="fixed inset-0 flex flex-col bg-white overflow-hidden md:static md:h-screen">
      {/* CSS for drag animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
      {/* Calendar Setup Banner - shown when calendar is sparse */}
      {!isDataLoading && meetings.length < 10 && habits.length < 3 && allTasks.length < 2 && (
        <div className="-mx-2 mb-2 px-4 py-2 bg-amber-50 border-b border-amber-100 sm:mx-0 sm:mb-0 sm:px-4 sm:py-3 sm:bg-amber-50 sm:border sm:border-amber-100 sm:rounded-lg sm:mx-0 sm:mt-0">
          <div className="flex items-start gap-2 sm:gap-3">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-700 leading-tight sm:leading-relaxed">
              Your calendar looks empty! Visit the{' '}
              <a href="/habits" className="font-medium underline hover:text-amber-800">
                Habits
              </a>
              ,{' '}
              <a href="/projects" className="font-medium underline hover:text-amber-800">
                Projects
              </a>
              , or use the <span className="font-medium">+ button</span> above to add meetings and
              fill out your schedule.
            </p>
          </div>
        </div>
      )}
      <CalendarTopBar
        settings={settings}
        plannedHours={plannedHours}
        actualHours={actualHours}
        plannedHoursBreakdown={plannedHoursBreakdown}
        actualHoursBreakdown={actualHoursBreakdown}
        showWorkHoursTooltip={showWorkHoursTooltip}
        showActualHoursTooltip={showActualHoursTooltip}
        showPlannedHoursTooltip={showPlannedHoursTooltip}
        showTaskScheduleModal={showTaskScheduleModal}
        setShowWorkHoursTooltip={setShowWorkHoursTooltip}
        setShowActualHoursTooltip={setShowActualHoursTooltip}
        setShowPlannedHoursTooltip={setShowPlannedHoursTooltip}
        setShowTaskScheduleModal={setShowTaskScheduleModal}
        navigateBackWeek={navigateBackWeek}
        navigateBackDay={navigateBackDay}
        navigateToToday={navigateToToday}
        navigateForwardDay={navigateForwardDay}
        navigateForwardWeek={navigateForwardWeek}
        showCalendarSettings={showCalendarSettings}
        setShowCalendarSettings={setShowCalendarSettings}
        onSyncGoogleCalendar={syncGoogleCalendar}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
      />

      {/* Headers */}
      <div
        className="grid border-b border-neutral-200 min-w-0"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="bg-neutral-100 border-r border-neutral-200 flex items-center justify-center py-1 sm:py-0.5 gap-1">
          <button
            className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
            title="Add meeting"
            onClick={handleAddMeeting}
          >
            <Plus className="w-4 h-4 sm:w-3 sm:h-3 text-neutral-600" />
          </button>
          {settings?.todoist_api_key && (
            <button
              className="hidden sm:block p-0.5 hover:bg-neutral-200 rounded transition-colors"
              title="Sync Todoist"
              disabled={isSyncingTodoist}
              onClick={async () => {
                setIsSyncingTodoist(true)
                try {
                  await syncTodoist()
                } finally {
                  setIsSyncingTodoist(false)
                }
              }}
            >
              <RefreshCw className={`w-3 h-3 text-neutral-600 ${isSyncingTodoist ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        {dayColumns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="py-1 px-1.5 sm:py-0.5 sm:px-1 bg-neutral-50 border-r border-neutral-200 last:border-r-0 min-w-0 flex items-center justify-center sm:justify-start"
          >
            <h2 className="text-base sm:text-sm font-medium text-neutral-900 truncate text-center sm:text-left">
              {column.label}
            </h2>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <CalendarGrid
        containerRef={containerRef}
        hourSlots={hourSlots}
        gridCols={gridCols}
        dayColumns={dayColumns}
        renderCalendarEvents={renderCalendarEvents}
        renderNoteBadges={renderNoteBadges}
        onAddNoteClick={(timeSlot, date) => {
          const [hour, minute] = timeSlot.split(':').map(Number)
          const noteDate = new Date(date)
          noteDate.setHours(hour, minute, 0, 0)
          // Create a temporary note — only saved to DB when content is added
          setViewingNote({
            id: null,
            title: '',
            content: '',
            start_time: noteDate.toISOString(),
            created_at: noteDate.toISOString(),
            _isNew: true,
          })
        }}
        handleTimeSlotClick={handleTimeSlotClick}
        handleTimeSlotContextMenu={handleTimeSlotContextMenu}
        handleMouseDown={handleMouseDown}
        handleMouseEnter={handleMouseEnter}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        isDragging={isDragging}
        dragStart={dragStart}
        dragEnd={dragEnd}
        isInDragSelection={isInDragSelection}
        getCurrentTimeLinePosition={getCurrentTimeLinePosition}
        habitDragPreview={draggingHabit && draggingHabitDate ? (() => {
          const dateStr = format(draggingHabitDate, 'yyyy-MM-dd')
          const colIdx = dayColumns.findIndex(c => c.dateStr === dateStr)
          if (colIdx === -1) return null
          const durationMin = draggingHabit.duration || 60
          const heightPx = (durationMin / 60) * 64
          // Compute new start from original + drag delta
          const [origH, origM] = habitOriginalStartRef.current.split(':').map(Number)
          const deltaMin = deltaYToMinutes(habitDragY)
          const totalMin = origH * 60 + origM + deltaMin
          const newH = Math.max(0, Math.floor(totalMin / 60))
          // Grid starts at 6am, hours 0-4 are at index 18-22
          const hourIndex = newH < 5 ? newH + 18 : newH - 6
          const minuteFrac = (totalMin % 60) / 60
          const topPx = (hourIndex + minuteFrac) * 64
          return { columnIndex: colIdx, topPx, heightPx }
        })() : null}
      />

      <TaskScheduleModal
        showTaskScheduleModal={showTaskScheduleModal}
        setShowTaskScheduleModal={setShowTaskScheduleModal}
        scheduledTasksCache={scheduledTasksCache}
        allTasks={allTasks}
        tasksDailyLogs={tasksDailyLogs}
      />

      {/* Note View Modal */}
      <NoteModal
        note={viewingNote}
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        onDelete={async (noteId) => {
          await supabase.from('cassian_habits_notes').delete().eq('id', noteId)
          setViewingNote(null)
        }}
      />
    </div>
  )
}

const Calendar = () => {
  const handlersRef = useRef<Record<string, Function>>({})
  const [meetingTitles, setMeetingTitles] = useState<{ title: string; count: number; lastUsed: Date }[]>([])
  const [meetingCategories, setMeetingCategories] = useState<{ id: string; name: string; color: string }[]>([])
  const [calendarHabits, setCalendarHabits] = useState<any[]>([])

  return (
    <ModalProvider
      onSaveMeeting={async (e, updatedMeeting, editingMeeting) => {
        await handlersRef.current.saveMeeting?.(e, updatedMeeting, editingMeeting)
      }}
      onDeleteMeeting={async (meeting) => {
        await handlersRef.current.deleteMeeting?.(meeting)
      }}
      onCompleteTask={async (task) => {
        const completedId = await handleCompleteTask(task)
        if (completedId) handlersRef.current.removeTask?.(completedId)
      }}
      onDeleteTask={async (task) => {
        const deletedId = await handleDeleteTask(task)
        if (deletedId) handlersRef.current.removeTask?.(deletedId)
      }}
      onHabitTimeChange={async (habitId, date, newTime, newDuration) => {
        await handlersRef.current.habitTimeChange?.(habitId, date, newTime, newDuration)
      }}
      onHabitSkip={async (habitId, date) => {
        await handlersRef.current.habitSkip?.(habitId, date)
      }}
      onUpdateSession={async () => {}}
      onTaskLogCreated={() => { window.location.reload() }}
      onUpdateMeetingEndTime={async (meetingId, newEndTime) => {
        await handlersRef.current.updateMeetingEndTime?.(meetingId, newEndTime)
      }}
      onDeleteTaskLog={async (logId) => {
        await supabase.from('cassian_tasks_daily_logs').delete().eq('id', logId)
      }}
      onRemoveTaskLogFromUI={(logId) => {
        handlersRef.current.removeTaskLog?.(logId)
      }}
      onAddHabitBlock={(habitId, date, startTime, duration) => {
        handlersRef.current.addHabitBlock?.(habitId, date, startTime, duration)
      }}
      onMeetingHabitLinked={(meetingId, habitId) => {
        handlersRef.current.linkMeetingHabit?.(meetingId, habitId)
      }}
      onAddNote={() => {
        handlersRef.current.addNote?.()
      }}
      meetingTitles={meetingTitles}
      meetingCategories={meetingCategories}
      habits={calendarHabits}
    >
      <CalendarContent handlersRef={handlersRef} onMeetingTitlesLoaded={setMeetingTitles} onMeetingCategoriesLoaded={setMeetingCategories} onHabitsLoaded={setCalendarHabits} />
    </ModalProvider>
  )
}

export default memo(Calendar)
