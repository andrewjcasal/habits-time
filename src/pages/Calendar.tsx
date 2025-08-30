import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Plus,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Sun,
} from 'lucide-react'
import { useCalendarData } from '../hooks/useCalendarData'
import { useVirtualizedCalendar } from '../hooks/useVirtualizedCalendar'
import { Meeting } from '../types'
import MeetingModal from '../components/MeetingModal'
import CalendarTaskModal from '../components/CalendarTaskModal'
import HabitModal from '../components/HabitModal'
import SessionEditModal from '../components/SessionEditModal'
import CalendarEvent from '../components/CalendarEvent'
import {
  handleHabitTimeChange,
  handleHabitSkip,
  handleCompleteTask,
  handleDeleteTask,
} from '../utils/calendarDatabaseOperations'
import { calculateWorkHours } from '../utils/workHoursCalculation'
import { ModalProvider, useModal } from '../contexts/ModalContext'

interface CalendarContentProps {
  onSetSaveHandler: (handler: (e: React.FormEvent, updatedMeeting: any, editingMeeting?: Meeting) => Promise<void>) => void
  onSetDeleteHandler: (handler: (meeting: Meeting) => Promise<void>) => void
}

const CalendarContent = ({ onSetSaveHandler, onSetDeleteHandler }: CalendarContentProps) => {
  // Helper function to format duration without rounding quarter hours
  const formatDuration = (duration: number): string => {
    if (duration % 1 === 0) return duration.toString()
    if (duration === 0.25) return '0.25'
    if (duration === 0.5) return '0.5' 
    if (duration === 0.75) return '0.75'
    return duration.toString()
  }

  const { openMeetingModal, openHabitModal, openTaskModal, openSessionModal } = useModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showActualHoursTooltip, setShowActualHoursTooltip] = useState(false)
  const [showPlannedHoursTooltip, setShowPlannedHoursTooltip] = useState(false)
  const [showWorkHoursTooltip, setShowWorkHoursTooltip] = useState(false)
  const [showHabitModal, setShowHabitModal] = useState(false)
  const [selectedHabit, setSelectedHabit] = useState<any>(null)
  const [selectedHabitDate, setSelectedHabitDate] = useState<Date | null>(null)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ time: string; date: Date } | null>(
    null
  )
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)

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
    return new Date()
  }

  const [baseDate, setBaseDate] = useState(getInitialDate)
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    date: '',
    location: '',
    meeting_type: 'general' as Meeting['meeting_type'],
    priority: 'medium' as Meeting['priority'],
    category_id: undefined as string | undefined,
  })

  const {
    allTasks,
    dayColumns,
    hourSlots,
    getCurrentTimeLinePosition,
    habits,
    sessions,
    meetings,
    tasksDailyLogs,
    currentTime,
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
    tasksScheduled,
    scheduledTasksCache,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    isDataLoading,
    refreshCalendarOnHabitChange,
  } = useCalendarData(windowWidth, baseDate)

  // Calendar data already includes habits - no need for separate useHabits hook

  // Virtual scrolling for performance
  const virtualizedCalendar = useVirtualizedCalendar(hourSlots.length, {
    itemHeight: 64, // h-16 = 64px
    containerHeight,
    overscan: 3,
  })

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

  // Update container height when component mounts
  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight)
    }
  }, [])

  const handleTimeSlotClick = (event: React.MouseEvent, timeSlot: string, date: Date) => {
    // Check if the click originated from a calendar event
    const target = event.target as HTMLElement
    if (target.closest('[data-calendar-event]')) {
      return // Don't open meeting modal if clicking on a calendar event
    }
    openMeetingModal({ time: timeSlot, date })
  }

  const handleAddMeeting = () => {
    openMeetingModal()
  }

  const handleEditMeeting = (meeting: Meeting) => {
    openMeetingModal(undefined, meeting)
  }

  const handleSaveMeeting = async (e: React.FormEvent, updatedMeeting: typeof newMeeting, editingMeeting?: Meeting) => {
    e.preventDefault()
    try {
      // Parse the date string and create local date objects
      const [year, month, day] = updatedMeeting.date.split('-').map(Number)
      const [startHour, startMinute] = updatedMeeting.start_time.split(':').map(Number)
      const [endHour, endMinute] = updatedMeeting.end_time.split(':').map(Number)

      // Create dates in local timezone (not UTC)
      const startTime = new Date(year, month - 1, day, startHour, startMinute)
      const endTime = new Date(year, month - 1, day, endHour, endMinute)

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

      // Task scheduling will be automatically regenerated by useCalendarData hook

      setNewMeeting({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        date: '',
        location: '',
        meeting_type: 'general',
        priority: 'medium',
        category_id: undefined,
      })
      setShowMeetingModal(false)
      setSelectedTimeSlot(null)
      setEditingMeeting(null)
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

  const handleTaskClick = (task: any) => {
    openTaskModal(task)
  }

  const handleHabitClick = (habit: any, date: Date) => {
    openHabitModal(habit, date)
  }

  const handleSessionClick = (session: any) => {
    openSessionModal(session)
  }

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
      // Reload page to regenerate conflict maps and show tasks in skipped habit slots
      window.location.reload()
    } catch (error) {
      console.error('Error skipping habit:', error)
      throw error
    }
  }

  const handleCompleteTaskWrapper = async () => {
    await handleCompleteTask(selectedTask)
  }

  const handleDeleteTaskWrapper = async () => {
    await handleDeleteTask(selectedTask)
  }

  const closeModal = () => {
    setShowMeetingModal(false)
    setShowTaskModal(false)
    setShowHabitModal(false)
    setShowSessionModal(false)
    setSelectedTimeSlot(null)
    setEditingMeeting(null)
    setSelectedTask(null)
    setSelectedHabit(null)
    setSelectedHabitDate(null)
    setSelectedSession(null)
    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Helper function to get quarter-hour from mouse position within a time slot
  const getQuarterFromMousePosition = (event: React.MouseEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const y = event.clientY - rect.top
    const quarterHeight = rect.height / 4
    return Math.floor(y / quarterHeight)
  }

  // Helper function to convert hour index and quarter to time string
  const quarterToTimeString = (hourIndex: number, quarter: number) => {
    const hour = hourSlots[hourIndex]
    if (!hour) return '09:00'

    const [hourStr] = hour.time.split(':')
    const hourNum = parseInt(hourStr, 10)
    const minutes = quarter * 15

    return `${hourNum.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Drag handlers for creating meetings
  const handleMouseDown = (
    event: React.MouseEvent,
    timeSlot: string,
    date: Date,
    hourIndex: number,
    columnIndex: number
  ) => {
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

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      // Calculate start and end times with quarter-hour precision
      const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
      const endTotalQuarters = dragEnd.hourIndex * 4 + dragEnd.quarter

      const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
      const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters) + 1 // Add 1 for exclusive end

      const startHourIndex = Math.floor(minQuarters / 4)
      const startQuarter = minQuarters % 4
      const endHourIndex = Math.floor(maxQuarters / 4)
      const endQuarter = maxQuarters % 4

      const startTime = quarterToTimeString(startHourIndex, startQuarter)
      const endTime = quarterToTimeString(endHourIndex, endQuarter)

      // Use the modal provider to open the meeting modal with the dragged time range
      openMeetingModal({ time: startTime, date: dragStart.date, endTime: endTime })
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  // Add global mouse up listener to handle mouse up outside the calendar
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp()
      }
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

  // Common styles for all calendar events
  const getEventStyle = (
    topPosition: number,
    height: number,
    zIndex: number = 5,
    leftOffset: number = 0,
    widthFraction: number = 1
  ) => ({
    left: `${leftOffset}%`,
    width: `${93 * widthFraction}%`,
    top: `${topPosition}%`,
    height: `${height - 2}px`, // Reduce height by 2px for separation
    zIndex,
  })

  // Render all calendar events for a time slot
  const renderCalendarEvents = useCallback(
    (timeSlot: string, date: Date) => {
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

      // For past dates and today: show task daily logs
      // For today and future: show auto-generated tasks
      const tasksInSlot =
        (isToday || isFuture) && tasksScheduled ? getTasksForTimeSlot(timeSlot, date) : []
      const tasksDailyLogsInSlot =
        isPast || isToday ? getTasksDailyLogsForTimeSlot(timeSlot, date) : []

      // Log performance data for each time slot with blocks
      const totalBlocks =
        habitsInSlot.length +
        sessionsInSlot.length +
        meetingsInSlot.length +
        tasksInSlot.length +
        tasksDailyLogsInSlot.length +
        buffersInSlot.length +
        categoryBuffersInSlot.length
      if (totalBlocks > 0) {
      }

      // Calculate vertical offsets to stack items without overlap
      let currentVerticalOffset = 0
      const baseItemHeight = 32 // Base height for calculating offsets

      return (
        <>
          {/* Habits */}
          {habitsInSlot.map((habit, index) => {
            // Calculate effective duration (daily log override or default habit duration)
            const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateStr)
            const effectiveDuration = dailyLog?.duration || habit.duration || 0
            const habitHeight = effectiveDuration ? (effectiveDuration / 60) * 64 : 64
            const isRescheduled = habit.isRescheduled || false

            // Calculate position with vertical offset
            const baseTopPosition = habit.topPosition || 0
            const verticalOffset = index * baseItemHeight
            const adjustedTopPosition = baseTopPosition + (verticalOffset / 64) * 100

            return (
              <CalendarEvent
                key={`habit-${habit.id}`}
                type="habit"
                style={getEventStyle(adjustedTopPosition, habitHeight)}
                onClick={e => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleHabitClick(habit, date)
                }}
                eventTitle={habit.name}
                duration={effectiveDuration > 0 ? `${formatDuration(effectiveDuration / 60)}h` : undefined}
                icon={isRescheduled ? <Clock className="w-1.5 h-1.5" /> : undefined}
              />
            )
          })}

          {/* Sessions */}
          {sessionsInSlot.map((session, index) => {
            const sessionHeight = session.scheduled_hours * 64

            // Calculate position after habits
            const baseTopPosition = session.topPosition || 0
            const verticalOffset = (habitsInSlot.length + index) * baseItemHeight
            const adjustedTopPosition = baseTopPosition + (verticalOffset / 64) * 100

            return (
              <CalendarEvent
                key={`session-${session.id}`}
                type="session"
                style={getEventStyle(adjustedTopPosition, sessionHeight, 10)}
                onClick={e => {
                  e.stopPropagation()
                  handleSessionClick(session)
                }}
                eventTitle={session.projects?.name || 'Project Session'}
                duration={`${session.scheduled_hours}h`}
              />
            )
          })}

          {/* Auto-scheduled Tasks */}
          {tasksInSlot.map(task => {
            const currentHour = parseInt(timeSlot.split(':')[0])
            const taskStartTime = task.startTime || task.startHour

            // Calculate position within the starting hour slot
            const minutesIntoHour = (taskStartTime - currentHour) * 60
            let topPositionInSlot = (minutesIntoHour / 60) * 100

            // Check if there are habits in this slot that would end during this hour
            habitsInSlot.forEach(habit => {
              const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateStr)
              const effectiveDuration = dailyLog?.duration || habit.duration || 0

              // Parse habit start time correctly (e.g., "17:30" -> 17.5)
              const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
              const [habitHour, habitMinute] = effectiveStartTime
                ? effectiveStartTime.split(':').map(Number)
                : [currentHour, 0]
              const habitStartTime = habitHour + habitMinute / 60
              const habitEndTime = habitStartTime + effectiveDuration / 60

              // If habit ends in this time slot and task actually conflicts with the habit, adjust task position
              // Only adjust if the task starts during or after the habit starts (not before)
              if (
                habitEndTime > taskStartTime &&
                habitStartTime <= taskStartTime &&
                habitStartTime <= currentHour + 1
              ) {
                const habitEndMinutes = (habitEndTime - currentHour) * 60
                const habitEndPosition = (habitEndMinutes / 60) * 100
                if (habitEndPosition > topPositionInSlot) {
                  topPositionInSlot = habitEndPosition
                }
              }
            })

            const taskHeight = (task.estimated_hours || 1) * 64
            const isPlaceholder = task.isPlaceholder || false

            const finalStyle = getEventStyle(topPositionInSlot, taskHeight, 5)

            return (
              <CalendarEvent
                key={`task-${task.id}`}
                type={isPlaceholder ? 'placeholder' : 'task'}
                style={finalStyle}
                onClick={e => {
                  e.stopPropagation()
                  handleTaskClick(task)
                }}
                eventTitle={`${task.title}${isPlaceholder ? ' 💰' : ''}`}
                duration={`${task.estimated_hours}h`}
              />
            )
          })}

          {/* Meetings */}
          {meetingsInSlot.map(meeting => {
            const meetingStart = new Date(meeting.start_time)
            const meetingEnd = new Date(meeting.end_time)
            const minutesIntoHour = meetingStart.getMinutes()
            const topPositionInSlot = (minutesIntoHour / 60) * 100
            const meetingDuration = (meetingEnd.getTime() - meetingStart.getTime()) / (1000 * 60)
            const meetingHeight = (meetingDuration / 60) * 64

            return (
              <CalendarEvent
                key={`meeting-${meeting.id}`}
                type="meeting"
                style={getEventStyle(topPositionInSlot, meetingHeight, 15)}
                onClick={e => {
                  e.stopPropagation()
                  handleEditMeeting(meeting)
                }}
                eventTitle={meeting.title}
                duration={`${Math.round(meetingDuration)}min`}
              />
            )
          })}

          {/* Task Daily Logs */}
          {tasksDailyLogsInSlot.map(log => {
            // Use actual_duration if available, otherwise fall back to scheduled_duration
            const duration = log.estimated_hours || 1
            const logHeight = duration * 64

            return (
              <CalendarEvent
                key={`task-daily-log-${log.id}`}
                type="tasklog"
                style={getEventStyle(log.topPosition, logHeight, 20)}
                onClick={e => {
                  e.stopPropagation()
                  handleTaskClick(log.tasks)
                }}
                eventTitle={log.tasks?.title || 'Task Log'}
                subtitle={log.tasks?.projects?.name || 'Project'}
                duration={`${duration}h`}
              />
            )
          })}

          {/* Buffer Time (Daily Buffers) */}
          {buffersInSlot.map(buffer => {
            const bufferHeight = (buffer.duration / 60) * 64

            return (
              <CalendarEvent
                key={`buffer-${buffer.id}`}
                type={buffer.isReduced ? 'reduced-buffer' : 'buffer'}
                style={getEventStyle(buffer.topPosition || 0, bufferHeight, 8)}
                title={`${buffer.title} - ${formatDuration(buffer.duration / 60)} hours${
                  buffer.isReduced ? ' (reduced due to same day)' : ''
                }`}
                eventTitle={buffer.title}
                duration={`${formatDuration(buffer.duration / 60)}h`}
              />
            )
          })}

          {/* Category Buffers (Weekly Buffers) */}
          {categoryBuffersInSlot.map(categoryBuffer => {
            const bufferHeight = categoryBuffer.duration * 64 // Duration is in hours

            return (
              <CalendarEvent
                key={`category-buffer-${categoryBuffer.id}`}
                type="category-buffer"
                style={getEventStyle(categoryBuffer.topPosition || 0, bufferHeight, 6)}
                title={`${categoryBuffer.category_name} Buffer - ${categoryBuffer.remaining_hours.toFixed(1)} hours remaining this week`}
                eventTitle={categoryBuffer.category_name}
                subtitle="Buffer Time"
                duration={`${formatDuration(categoryBuffer.duration)}h`}
              />
            )
          })}
        </>
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
      tasksScheduled,
      handleHabitClick,
      handleTaskClick,
    ]
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
      {/* Top Bar with Navigation and Work Hours */}
      <div className="bg-neutral-100 border-b border-neutral-200 px-2 py-0.5 sm:px-0">
        {/* Navigation, Work Hours Label, and Planned/Actual all on one line */}
        <div className="flex items-center justify-between sm:px-2">
          {/* Left side: Navigation Controls */}
          <div className="flex items-center">
            <button
              onClick={navigateBackWeek}
              className=" hover:bg-neutral-200 rounded transition-colors"
              title="Go back 5 days"
            >
              <ChevronsLeft className="w-2 h-2 text-neutral-600" />
            </button>
            <button
              onClick={navigateBackDay}
              className="hover:bg-neutral-200 rounded transition-colors"
              title="Go back 1 day"
            >
              <ChevronLeft className="w-2 h-2 text-neutral-600" />
            </button>
            <button
              onClick={navigateToToday}
              className="hover:bg-neutral-200 rounded transition-colors mx-1"
              title="Go to today"
            >
              <Sun className="w-2 h-2 text-yellow-600" />
            </button>
            <button
              onClick={navigateForwardDay}
              className="hover:bg-neutral-200 rounded transition-colors"
              title="Go forward 1 day"
            >
              <ChevronRight className="w-2 h-2 text-neutral-600" />
            </button>
            <button
              onClick={navigateForwardWeek}
              className="hover:bg-neutral-200 rounded transition-colors"
              title="Go forward 5 days"
            >
              <ChevronsRight className="w-2 h-2 text-neutral-600" />
            </button>

            {/* Work Hours Label - desktop only */}
            <div className="hidden sm:block text-sm text-neutral-700 ml-2 work-hours-tooltip relative">
              {settings ? (
                <div className="flex items-center">
                  <span>Work Hours</span>
                  <button
                    onClick={() => setShowWorkHoursTooltip(!showWorkHoursTooltip)}
                    className="ml-0 hover:bg-neutral-200 rounded p-0.5 transition-colors"
                    title="Work hours details"
                  >
                    <Info className="w-2 h-2 text-neutral-500" />
                  </button>
                  {showWorkHoursTooltip && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-xs whitespace-nowrap z-50">
                      <div className="font-medium mb-1">Work Schedule:</div>
                      <div>
                        Daily: {settings.work_hours_start} - {settings.work_hours_end}
                      </div>
                      <div>
                        Week ends:{' '}
                        {settings.week_ending_day?.charAt(0).toUpperCase() +
                          settings.week_ending_day?.slice(1)}{' '}
                        {new Date(
                          `1970-01-01T${settings.week_ending_time || '20:30'}`
                        ).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </div>
                      <div>
                        Timezone: {settings.week_ending_timezone?.split('/')[1]?.replace('_', ' ')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-neutral-400">Loading work hours...</span>
              )}
            </div>
          </div>

          {/* Right side: Planned and Actual hours */}
          <div className="flex items-center gap-2">
            <div className="text-sm relative planned-hours-tooltip">
              <span className="text-neutral-600">Planned:</span>
              <span
                className="font-medium text-neutral-900 ml-1 cursor-pointer hover:underline"
                onClick={() => setShowPlannedHoursTooltip(!showPlannedHoursTooltip)}
              >
                {plannedHours.toFixed(1)}h ($
                {plannedHoursBreakdown
                  .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
                  .reduce((sum, item) => sum + item.hours * Number(item.hourlyRate), 0)
                  .toFixed(0)}
                )
              </span>
              {showPlannedHoursTooltip && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 shadow-lg rounded-md p-2 z-50">
                  <div className="text-sm font-medium text-neutral-900">
                    Planned Hours Breakdown
                  </div>
                  {plannedHoursBreakdown.filter(
                    item => item.hourlyRate && Number(item.hourlyRate) > 0
                  ).length > 0 ? (
                    <div className="space-y-2">
                      {(() => {
                        // Group by project
                        const groupedByProject = plannedHoursBreakdown
                          .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
                          .reduce((acc, item) => {
                            const existingProject = acc.find(
                              group => group.projectName === item.projectName
                            )
                            if (existingProject) {
                              existingProject.sessions.push(item)
                              existingProject.totalHours += item.hours
                              existingProject.totalValue += item.hours * Number(item.hourlyRate)
                            } else {
                              acc.push({
                                projectName: item.projectName,
                                hourlyRate: item.hourlyRate,
                                totalHours: item.hours,
                                totalValue: item.hours * Number(item.hourlyRate),
                                sessions: [item],
                              })
                            }
                            return acc
                          }, [])

                        return groupedByProject.map((project, projectIndex) => (
                          <div
                            key={projectIndex}
                            className="border-b border-neutral-100 last:border-b-0 pb-2 last:pb-0"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-neutral-900">
                                  {project.projectName}
                                </div>
                                <div className="text-neutral-500 text-xs">
                                  ${Number(project.hourlyRate)}/hr
                                </div>
                              </div>
                              <div className="text-neutral-900 font-medium">
                                {project.totalHours.toFixed(1)}h
                                <div className="text-blue-600 text-xs">
                                  ${project.totalValue.toFixed(0)}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-0.5 ml-2">
                              {project.sessions.map((session, sessionIndex) => (
                                <div
                                  key={sessionIndex}
                                  className="flex justify-between items-center text-xs"
                                >
                                  <div className="flex-1">
                                    <div className="text-neutral-600 truncate flex items-center">
                                      {session.sessionName}
                                      {session.isCompleted && (
                                        <span className="ml-2 text-green-600">✓</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-neutral-600">
                                    {session.hours.toFixed(1)}h
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      })()}
                      <div className="border-t border-neutral-200 pt-1 mt-2">
                        <div className="flex justify-between items-center text-sm font-medium">
                          <span>Total</span>
                          <span>
                            {plannedHoursBreakdown
                              .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
                              .reduce((sum, item) => sum + item.hours, 0)
                              .toFixed(1)}
                            h
                          </span>
                        </div>
                        {plannedHoursBreakdown.some(
                          item => item.hourlyRate && Number(item.hourlyRate) > 0
                        ) && (
                          <div className="flex justify-between items-center text-sm text-blue-600">
                            <span>Est. Value</span>
                            <span>
                              $
                              {plannedHoursBreakdown
                                .reduce(
                                  (sum, item) =>
                                    sum +
                                    item.hours *
                                      (Number(item.hourlyRate) > 0 ? Number(item.hourlyRate) : 0),
                                  0
                                )
                                .toFixed(0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">No planned work found</div>
                  )}
                </div>
              )}
            </div>
            <div className="hidden sm:block text-sm relative actual-hours-tooltip">
              <span className="text-neutral-600">Actual:</span>
              <span
                className="font-medium text-neutral-900 ml-1 cursor-pointer hover:underline"
                onClick={() => setShowActualHoursTooltip(!showActualHoursTooltip)}
              >
                {actualHours.toFixed(1)}h
              </span>
              {showActualHoursTooltip && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 shadow-lg rounded-md p-3 z-50">
                  <div className="text-sm font-medium text-neutral-900 mb-2">
                    Actual Hours Breakdown
                  </div>
                  {actualHoursBreakdown.length > 0 ? (
                    <div className="space-y-1">
                      {actualHoursBreakdown.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-xs">
                          <div className="flex-1">
                            <div className="font-medium text-neutral-900">{item.projectName}</div>
                            <div className="text-neutral-600">
                              {format(new Date(item.date), 'MMM d')}
                            </div>
                            {item.hourlyRate && Number(item.hourlyRate) > 0 && (
                              <div className="text-neutral-500">${Number(item.hourlyRate)}/hr</div>
                            )}
                          </div>
                          <div className="text-neutral-900 font-medium">
                            {item.hours.toFixed(1)}h
                            {item.hourlyRate && item.hourlyRate > 0 && (
                              <div className="text-green-600 text-xs">
                                ${(item.hours * item.hourlyRate).toFixed(0)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-neutral-200 pt-1 mt-2">
                        <div className="flex justify-between items-center text-sm font-medium">
                          <span>Total</span>
                          <span>{actualHours.toFixed(1)}h</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500">No completed sessions yet</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Headers */}
      <div
        className="grid border-b border-neutral-200 min-w-0"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="bg-neutral-100 border-r border-neutral-200 flex items-center justify-center py-1 sm:py-0.5">
          <button
            className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
            title="Add meeting"
            onClick={handleAddMeeting}
          >
            <Plus className="w-3 h-3 text-neutral-600" />
          </button>
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

      {/* Calendar Grid - Virtualized for Performance */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto relative"
        onScroll={virtualizedCalendar.handleScroll}
      >
        {/* Virtual scrolling container */}
        <div style={{ height: virtualizedCalendar.totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${virtualizedCalendar.offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {useMemo(() => {
              return hourSlots
                .slice(virtualizedCalendar.visibleRange.start, virtualizedCalendar.visibleRange.end)
                .map((hour, index) => {
                  const hourIndex = virtualizedCalendar.visibleRange.start + index

                  const timeSlotDiv = (
                    <div
                      key={hourIndex}
                      className="grid border-b border-neutral-300"
                      style={{
                        gridTemplateColumns: gridCols,
                        height: virtualizedCalendar.itemHeight,
                      }}
                    >
                      <div className="border-r border-neutral-300 py-0 px-1 h-16 bg-neutral-50 flex items-start">
                        <div className="font-mono text-neutral-600 text-xs">{hour.display}</div>
                      </div>
                      {dayColumns.map((column, columnIndex) => {
                        const isInSelection = isInDragSelection(hourIndex, columnIndex)

                        return (
                          <div
                            key={columnIndex}
                            className={`border-r border-neutral-300 last:border-r-0 p-1 sm:p-0.5 h-16 text-sm sm:text-xs relative cursor-pointer select-none`}
                            onClick={(e) =>
                              !isDragging && handleTimeSlotClick(e, hour.time, column.date)
                            }
                            onMouseDown={e =>
                              handleMouseDown(e, hour.time, column.date, hourIndex, columnIndex)
                            }
                            onMouseEnter={e =>
                              handleMouseEnter(e, hour.time, column.date, hourIndex, columnIndex)
                            }
                            onMouseMove={e =>
                              handleMouseMove(e, hour.time, column.date, hourIndex, columnIndex)
                            }
                            style={{
                              userSelect: 'none',
                            }}
                          >
                            {/* Quarter-hour visual divisions with hover states */}
                            <div className="absolute inset-0">
                              {/* Quarter-hour hover zones */}
                              {[0, 1, 2, 3].map(quarter => (
                                <div
                                  key={`quarter-${quarter}`}
                                  className="absolute left-0 right-0 hover:bg-neutral-50"
                                  style={{
                                    top: `${quarter * 25}%`,
                                    height: '25%',
                                  }}
                                />
                              ))}
                              {/* Quarter-hour dividing lines */}
                              <div className="absolute inset-0 pointer-events-none">
                                {[1, 2, 3].map(quarter => (
                                  <div
                                    key={`divider-${quarter}`}
                                    className="absolute left-0 right-0 h-px"
                                    style={{
                                      top: `${quarter * 25}%`,
                                      borderTop: '1px solid rgba(0,0,0,0.05)',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Render calendar events */}
                            {renderCalendarEvents(hour.time, column.date)}
                          </div>
                        )
                      })}
                    </div>
                  )

                  return timeSlotDiv
                })
            }, [
              hourSlots,
              virtualizedCalendar.visibleRange,
              gridCols,
              virtualizedCalendar.itemHeight,
              dayColumns,
              renderCalendarEvents,
              handleTimeSlotClick,
            ])}
          </div>
        </div>

        {/* Unified Drag Selection Overlay */}
        {isDragging && dragStart && dragEnd && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {(() => {
              const startTotalQuarters = dragStart.hourIndex * 4 + dragStart.quarter
              const endTotalQuarters = dragEnd.hourIndex * 4 + dragEnd.quarter
              const minQuarters = Math.min(startTotalQuarters, endTotalQuarters)
              const maxQuarters = Math.max(startTotalQuarters, endTotalQuarters)

              // Calculate pixel positions
              const startHourIndex = Math.floor(minQuarters / 4)
              const startQuarter = minQuarters % 4
              const endHourIndex = Math.floor(maxQuarters / 4)
              const endQuarter = maxQuarters % 4

              const topPosition =
                startHourIndex * 64 + startQuarter * 16 - virtualizedCalendar.offsetY
              const endPosition =
                endHourIndex * 64 + (endQuarter + 1) * 16 - virtualizedCalendar.offsetY
              const height = endPosition - topPosition

              // Calculate column position
              const timeColumnWidth = `calc((100% - ${gridCols.split(' ')[0]}) / ${
                dayColumns.length
              })`
              const leftPosition = `calc(${gridCols.split(' ')[0]} + ${
                dragStart.columnIndex
              } * ${timeColumnWidth})`

              return (
                <div
                  className="absolute"
                  style={{
                    top: `${topPosition}px`,
                    left: leftPosition,
                    width: timeColumnWidth,
                    height: `${height}px`,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    animation: 'pulse 1s infinite',
                    borderRadius: '2px',
                  }}
                />
              )
            })()}
          </div>
        )}

        {/* Current Time Line */}
        <div className="absolute inset-0 pointer-events-none">
          {dayColumns.map((column, columnIndex) => {
            const timeLinePosition = getCurrentTimeLinePosition(column.date)
            if (!timeLinePosition) return null

            return (
              <div
                key={`timeline-${columnIndex}`}
                className="absolute z-20"
                style={{
                  top: `${timeLinePosition}px`,
                  left: '80px',
                  right: '0',
                  height: '2px',
                  display: 'grid',
                  gridTemplateColumns: gridCols.replace('80px ', ''),
                }}
              >
                {dayColumns.map((_, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`relative ${
                      dayIndex === columnIndex ? 'bg-red-500' : 'bg-transparent'
                    }`}
                    style={{
                      height: '2px',
                      boxShadow:
                        dayIndex === columnIndex ? '0 0 4px rgba(239, 68, 68, 0.5)' : 'none',
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <MeetingModal
        onTaskLogCreated={async () => {
          // Refresh calendar data when a task log is created
          window.location.reload()
        }}
        onBackToTask={selectedTask ? () => {
          // Go back to task modal from meeting modal
          setShowMeetingModal(false)
          setShowTaskModal(true)
        } : undefined}
      />

      <CalendarTaskModal
        isOpen={showTaskModal}
        onClose={closeModal}
        task={selectedTask}
        onComplete={handleCompleteTaskWrapper}
        onDelete={handleDeleteTaskWrapper}
        onAddMeeting={() => {
          // Extract time slot info from the selected task and open meeting modal
          if (selectedTask) {
            const taskDate = new Date(selectedTask.startTime ? selectedTask.startTime * 60 * 60 * 1000 : Date.now())
            const timeSlot = selectedTask.startTime ? 
              `${Math.floor(selectedTask.startTime).toString().padStart(2, '0')}:${((selectedTask.startTime % 1) * 60).toString().padStart(2, '0')}` :
              '09:00'
            
            setSelectedTimeSlot({ time: timeSlot, date: taskDate })
            setNewMeeting({
              title: '',
              description: '',
              start_time: timeSlot,
              end_time: timeSlot,
              date: format(taskDate, 'yyyy-MM-dd'),
              location: '',
              meeting_type: 'general',
              priority: 'medium',
              category_id: undefined,
            })
            setShowTaskModal(false)
            setShowMeetingModal(true)
          }
        }}
      />

      <HabitModal
        onTimeChange={handleHabitTimeChangeWithReset}
        onSkip={handleHabitSkipWithReset}
      />

      {selectedSession && (
        <SessionEditModal
          isOpen={showSessionModal}
          onClose={closeModal}
          session={selectedSession}
          onUpdateSession={async (sessionId: string, updates: any) => {
            // This would typically call a function from useCalendarData
            // For now, we'll add a placeholder
            console.log('Update session:', sessionId, updates)
            closeModal()
          }}
        />
      )}
    </div>
  )
}

const Calendar = () => {
  let saveMeetingHandler: (e: React.FormEvent, updatedMeeting: any, editingMeeting?: Meeting) => Promise<void>
  let deleteMeetingHandler: (meeting: Meeting) => Promise<void>

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
    >
      <CalendarContent 
        onSetSaveHandler={(handler) => { saveMeetingHandler = handler }}
        onSetDeleteHandler={(handler) => { deleteMeetingHandler = handler }}
      />
    </ModalProvider>
  )
}

export default memo(Calendar)
