import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Info, FileText, RefreshCw } from 'lucide-react'
import NoteModal from '../components/NoteModal'
import { useCalendarData } from '../hooks/useCalendarData'
import { supabase } from '../lib/supabase'
import { Meeting } from '../types'
import TaskScheduleModal from '../components/TaskScheduleModal'
import {
  handleHabitTimeChange,
  handleHabitSkip,
  handleCompleteTask,
  handleDeleteTask,
} from '../utils/calendarDatabaseOperations'
import { calculateWorkHours } from '../utils/workHoursCalculation'
import { ModalProvider, useModal } from '../contexts/ModalContext'
import CalendarEventSlots from '../components/CalendarEventSlots'
import CalendarTopBar from '../components/CalendarTopBar'
import CalendarGrid, { getQuarterFromMousePosition, quarterToTimeString } from '../components/CalendarGrid'

interface CalendarContentProps {
  onSetSaveHandler: (handler: (e: React.FormEvent, updatedMeeting: any, editingMeeting?: Meeting) => Promise<void>) => void
  onSetDeleteHandler: (handler: (meeting: Meeting) => Promise<void>) => void
  onSetHabitTimeChangeHandler: (handler: (habitId: string, date: string, newTime: string, newDuration?: number) => Promise<void>) => void
  onSetHabitSkipHandler: (handler: (habitId: string, date: string) => Promise<void>) => void
  onSetRemoveTaskHandler: (handler: (taskId: string) => void) => void
  onSetRemoveTaskLogHandler: (handler: (logId: string) => void) => void
  onSetUpdateMeetingEndTimeHandler: (handler: (meetingId: string, newEndTime: string) => Promise<void>) => void
}

const CalendarContent = ({ onSetSaveHandler, onSetDeleteHandler, onSetHabitTimeChangeHandler, onSetHabitSkipHandler, onSetRemoveTaskHandler, onSetRemoveTaskLogHandler, onSetUpdateMeetingEndTimeHandler }: CalendarContentProps) => {

  const { openMeetingModal, openHabitModal, openTaskModal, openSessionModal, closeAllModals, openResizeConflictDialog } = useModal()
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


  // Calendar notes come from useCalendarData (merged into single fetch)

  // Meeting resize state
  const [resizingMeeting, setResizingMeeting] = useState<any>(null)
  const [resizeNewEndTime, setResizeNewEndTime] = useState<Date | null>(null)
  const resizeStartYRef = useRef<number>(0)
  const resizeStartEndTimeRef = useRef<Date | null>(null)

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
    skipHabitForDate,
    syncTodoist,
  } = useCalendarData(windowWidth, baseDate)

  // Calendar data already includes habits - no need for separate useHabits hook

  const gridCols =
    windowWidth > 1350
      ? '80px 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
      : windowWidth > 600
      ? '80px 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
      : '80px minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)'

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

  // Update container height and scroll to 2 hours before now
  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight)
      const now = new Date()
      const currentHour = now.getHours()
      const targetHour = Math.max(0, currentHour - 3)
      const hoursSince6am = Math.max(0, targetHour - 6)
      containerRef.current.scrollTop = hoursSince6am * 64
    }
  }, [])

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
    openMeetingModal({ time: precisetime, date })
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

      console.log('Meeting update data:', {
        start_time: updatedMeeting.start_time,
        end_time: updatedMeeting.end_time,
        date: updatedMeeting.date
      })
      
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
    // Check if the mousedown originated from a calendar event
    const target = event.target as HTMLElement
    if (target.closest('[data-calendar-event]')) {
      return // Don't start drag if clicking on a calendar event
    }
    
    const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
    console.log('Mouse down:', { hourIndex, quarter, timeSlot })
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
      console.log('Mouse enter:', { timeSlot, hourIndex, quarter })
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
      console.log('Mouse move:', { timeSlot, hourIndex, quarter })
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
    console.log('Mouse up:', { hasEvent: !!event, isDragging, dragStart, dragEnd, timeSlot, hourIndex })
    
    if (isDragging && dragStart) {
      // Force update dragEnd to the mouse up position if we have it
      let finalDragEnd = dragEnd
      if (event && timeSlot && date && hourIndex !== undefined && columnIndex !== undefined) {
        const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
        finalDragEnd = { time: timeSlot, date, hourIndex, columnIndex, quarter }
        console.log('Forcing dragEnd to mouse up position:', finalDragEnd)
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

        console.log('Drag debug (forced end position):', { 
          dragStart: dragStart.hourIndex + ':' + dragStart.quarter, 
          dragEnd: finalDragEnd.hourIndex + ':' + finalDragEnd.quarter,
          startTotalQuarters, 
          endTotalQuarters, 
          minQuarters,
          maxQuarters,
          startTime, 
          endTime 
        })

        // Only open modal if we have a valid drag (not just a click)
        if (startTotalQuarters !== endTotalQuarters) {
          dragOccurredRef.current = true
          openMeetingModal({ time: startTime, date: dragStart.date, endTime: endTime })
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
  const handleMeetingResizeStart = useCallback((meeting: any, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    meetingResizedRef.current = true
    setResizingMeeting(meeting)
    resizeStartYRef.current = e.clientY
    resizeStartEndTimeRef.current = new Date(meeting.end_time)
    setResizeNewEndTime(new Date(meeting.end_time))
  }, [])

  useEffect(() => {
    if (!resizingMeeting) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartYRef.current
      const deltaMinutes = Math.round(deltaY / 64 * 60 / 15) * 15 // snap to 15-min
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
    onSetSaveHandler(handleSaveMeeting)
    onSetDeleteHandler(handleDeleteMeeting)
    onSetHabitTimeChangeHandler(handleHabitTimeChangeWithReset)
    onSetHabitSkipHandler(handleHabitSkipWithReset)
    onSetRemoveTaskHandler(removeTaskFromCalendar)
    onSetRemoveTaskLogHandler(removeTaskLogFromUI)
    onSetUpdateMeetingEndTimeHandler(async (meetingId: string, newEndTime: string) => {
      await updateMeeting(meetingId, { end_time: newEndTime })
    })
  }, [handleSaveMeeting, handleDeleteMeeting, onSetSaveHandler, onSetDeleteHandler])

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
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
            <Plus className="w-3 h-3 text-neutral-600" />
          </button>
          {settings?.todoist_api_key && (
            <button
              className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
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
  let saveMeetingHandler: (e: React.FormEvent, updatedMeeting: any, editingMeeting?: Meeting) => Promise<void>
  let deleteMeetingHandler: (meeting: Meeting) => Promise<void>
  let habitTimeChangeHandler: (habitId: string, date: string, newTime: string, newDuration?: number) => Promise<void>
  let habitSkipHandler: (habitId: string, date: string) => Promise<void>
  let removeTaskHandler: (taskId: string) => void
  let removeTaskLogHandler: (logId: string) => void
  let updateMeetingEndTimeHandler: (meetingId: string, newEndTime: string) => Promise<void>

  return (
    <ModalProvider
      onSaveMeeting={async (e: React.FormEvent, updatedMeeting: any, editingMeeting?: Meeting) => {
        if (saveMeetingHandler) {
          return await saveMeetingHandler(e, updatedMeeting, editingMeeting)
        }
      }}
      onDeleteMeeting={async (meeting: Meeting) => {
        if (deleteMeetingHandler) {
          return await deleteMeetingHandler(meeting)
        }
      }}
      onCompleteTask={async (task: any) => {
        const completedId = await handleCompleteTask(task)
        if (completedId && removeTaskHandler) removeTaskHandler(completedId)
      }}
      onDeleteTask={async (task: any) => {
        const deletedId = await handleDeleteTask(task)
        if (deletedId && removeTaskHandler) removeTaskHandler(deletedId)
      }}
      onHabitTimeChange={async (habitId: string, date: string, newTime: string, newDuration?: number) => {
        if (habitTimeChangeHandler) await habitTimeChangeHandler(habitId, date, newTime, newDuration)
      }}
      onHabitSkip={async (habitId: string, date: string) => {
        if (habitSkipHandler) await habitSkipHandler(habitId, date)
      }}
      onUpdateSession={async (sessionId: string, updates: any) => {
        console.log('Update session:', sessionId, updates)
      }}
      onTaskLogCreated={() => { window.location.reload() }}
      onUpdateMeetingEndTime={async (meetingId: string, newEndTime: string) => {
        if (updateMeetingEndTimeHandler) await updateMeetingEndTimeHandler(meetingId, newEndTime)
      }}
      onDeleteTaskLog={async (logId: string) => {
        await supabase.from('cassian_tasks_daily_logs').delete().eq('id', logId)
      }}
      onRemoveTaskLogFromUI={(logId: string) => {
        if (removeTaskLogHandler) removeTaskLogHandler(logId)
      }}
    >
      <CalendarContent
        onSetSaveHandler={(handler) => { saveMeetingHandler = handler }}
        onSetDeleteHandler={(handler) => { deleteMeetingHandler = handler }}
        onSetHabitTimeChangeHandler={(handler) => { habitTimeChangeHandler = handler }}
        onSetHabitSkipHandler={(handler) => { habitSkipHandler = handler }}
        onSetRemoveTaskHandler={(handler) => { removeTaskHandler = handler }}
        onSetRemoveTaskLogHandler={(handler) => { removeTaskLogHandler = handler }}
        onSetUpdateMeetingEndTimeHandler={(handler) => { updateMeetingEndTimeHandler = handler }}
      />
    </ModalProvider>
  )
}

export default memo(Calendar)
