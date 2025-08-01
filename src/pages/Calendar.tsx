import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Info } from 'lucide-react'
import { useCalendarData } from '../hooks/useCalendarData'
import { useSettings } from '../hooks/useSettings'
import { useVirtualizedCalendar } from '../hooks/useVirtualizedCalendar'
import { Meeting } from '../types'
import MeetingModal from '../components/MeetingModal'
import CalendarTaskModal from '../components/CalendarTaskModal'
import HabitModal from '../components/HabitModal'
import {
  handleHabitTimeChange,
  handleHabitSkip,
  handleCompleteTask,
  handleDeleteTask,
} from '../utils/calendarDatabaseOperations'
import { calculateWorkHours } from '../utils/workHoursCalculation'

const Calendar = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [containerHeight, setContainerHeight] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showActualHoursTooltip, setShowActualHoursTooltip] = useState(false)
  const [showPlannedHoursTooltip, setShowPlannedHoursTooltip] = useState(false)
  const [showHabitModal, setShowHabitModal] = useState(false)
  const [selectedHabit, setSelectedHabit] = useState<any>(null)
  const [selectedHabitDate, setSelectedHabitDate] = useState<Date | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ time: string; date: Date } | null>(
    null
  )
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  
  // Drag-to-create meeting state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ time: string; date: Date; hourIndex: number; columnIndex: number; quarter: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ time: string; date: Date; hourIndex: number; columnIndex: number; quarter: number } | null>(null)

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
  })

  const { settings } = useSettings()
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
    buffers,
    tasksScheduled,
    scheduledTasksCache,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    isDataLoading,
  } = useCalendarData(windowWidth, baseDate)

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

  const handleTimeSlotClick = (timeSlot: string, date: Date) => {
    setEditingMeeting(null)
    setSelectedTimeSlot({ time: timeSlot, date })
    const [hour, minute] = timeSlot.split(':')
    const startTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    const endHour = parseInt(hour) + 1
    const endTime = `${endHour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`
    setNewMeeting({
      title: '',
      description: '',
      start_time: startTime,
      end_time: endTime,
      date: format(date, 'yyyy-MM-dd'),
      location: '',
      meeting_type: 'general',
      priority: 'medium',
    })
    setShowMeetingModal(true)
  }

  const handleAddMeeting = () => {
    setEditingMeeting(null)
    setNewMeeting({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      location: '',
      meeting_type: 'general',
      priority: 'medium',
    })
    setShowMeetingModal(true)
    setSelectedTimeSlot(null)
  }

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting)
    const startTime = new Date(meeting.start_time)
    const endTime = new Date(meeting.end_time)
    setNewMeeting({
      title: meeting.title,
      description: meeting.description || '',
      start_time: startTime.toTimeString().slice(0, 5),
      end_time: endTime.toTimeString().slice(0, 5),
      date: format(startTime, 'yyyy-MM-dd'),
      location: meeting.location || '',
      meeting_type: meeting.meeting_type,
      priority: meeting.priority,
    })
    setShowMeetingModal(true)
    setSelectedTimeSlot(null)
  }

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Parse the date string and create local date objects
      const [year, month, day] = newMeeting.date.split('-').map(Number)
      const [startHour, startMinute] = newMeeting.start_time.split(':').map(Number)
      const [endHour, endMinute] = newMeeting.end_time.split(':').map(Number)

      // Create dates in local timezone (not UTC)
      const startTime = new Date(year, month - 1, day, startHour, startMinute)
      const endTime = new Date(year, month - 1, day, endHour, endMinute)

      const meetingData = {
        title: newMeeting.title,
        description: newMeeting.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location: newMeeting.location,
        meeting_type: newMeeting.meeting_type,
        priority: newMeeting.priority,
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
      })
      setShowMeetingModal(false)
      setSelectedTimeSlot(null)
      setEditingMeeting(null)
    } catch (error) {
      console.error('Error saving meeting:', error)
    }
  }

  const handleDeleteMeeting = async () => {
    if (!editingMeeting) return

    try {
      await deleteMeeting(editingMeeting.id)

      // Task scheduling will be automatically regenerated by useCalendarData hook

      setShowMeetingModal(false)
      setSelectedTimeSlot(null)
      setEditingMeeting(null)
      setNewMeeting({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        date: '',
        location: '',
        meeting_type: 'general',
        priority: 'medium',
      })
    } catch (error) {
      console.error('Error deleting meeting:', error)
    }
  }

  const handleTaskClick = (task: any) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const handleHabitClick = (habit: any, date: Date) => {
    setSelectedHabit(habit)
    setSelectedHabitDate(date)
    setShowHabitModal(true)
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

  const handleHabitSkipWithReset = async (
    habitId: string,
    date: string
  ) => {
    try {
      await handleHabitSkip(habitId, date)
      // Task scheduling will be automatically regenerated by useCalendarData hook
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
    setSelectedTimeSlot(null)
    setEditingMeeting(null)
    setSelectedTask(null)
    setSelectedHabit(null)
    setSelectedHabitDate(null)
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
  const handleMouseDown = (event: React.MouseEvent, timeSlot: string, date: Date, hourIndex: number, columnIndex: number) => {
    const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
    setIsDragging(true)
    setDragStart({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
  }

  const handleMouseEnter = (event: React.MouseEvent, timeSlot: string, date: Date, hourIndex: number, columnIndex: number) => {
    if (isDragging && dragStart && columnIndex === dragStart.columnIndex) {
      const quarter = getQuarterFromMousePosition(event, event.currentTarget as HTMLElement)
      setDragEnd({ time: timeSlot, date, hourIndex, columnIndex, quarter })
    }
  }

  const handleMouseMove = (event: React.MouseEvent, timeSlot: string, date: Date, hourIndex: number, columnIndex: number) => {
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
      
      // Set up the meeting with the dragged time range
      setNewMeeting({
        title: '',
        description: '',
        start_time: startTime,
        end_time: endTime,
        date: format(dragStart.date, 'yyyy-MM-dd'),
        location: '',
        meeting_type: 'general' as Meeting['meeting_type'],
        priority: 'medium' as Meeting['priority'],
      })
      setSelectedTimeSlot({ time: startTime, date: dragStart.date })
      setShowMeetingModal(true)
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
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActualHoursTooltip, showPlannedHoursTooltip])

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

      // For past dates: only show task daily logs
      // For today and future: show auto-generated tasks
      const tasksInSlot =
        (isToday || isFuture) && tasksScheduled ? getTasksForTimeSlot(timeSlot, date) : []
      const tasksDailyLogsInSlot = isPast ? getTasksDailyLogsForTimeSlot(timeSlot, date) : []

      // Log performance data for each time slot with blocks
      const totalBlocks =
        habitsInSlot.length +
        sessionsInSlot.length +
        meetingsInSlot.length +
        tasksInSlot.length +
        tasksDailyLogsInSlot.length +
        buffersInSlot.length
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
              <div
                key={`habit-${habit.id}`}
                className={`absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-blue-100 border-blue-400 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors shadow-sm`}
                style={getEventStyle(adjustedTopPosition, habitHeight)}
                onClick={e => {
                  e.stopPropagation()
                  handleHabitClick(habit, date)
                }}
              >
                <div className="font-medium truncate flex-1 flex items-center">
                  {isRescheduled && (
                    <Clock className="w-3 h-3 sm:w-2.5 sm:h-2.5 mr-1 flex-shrink-0" />
                  )}
                  {habit.name}
                </div>
                {effectiveDuration > 0 && (
                  <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">
                    {effectiveDuration}min
                  </div>
                )}
              </div>
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
              <div
                key={`session-${session.id}`}
                className="absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-purple-100 border-purple-400 text-purple-800 shadow-sm"
                style={getEventStyle(adjustedTopPosition, sessionHeight, 10)}
              >
                <div className="font-medium truncate flex-1">
                  {session.projects?.name || 'Project Session'}
                </div>
                <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">
                  {session.scheduled_hours}h
                </div>
              </div>
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

              // If habit ends in this time slot and after task start time, adjust task position
              if (habitEndTime > taskStartTime && habitStartTime <= currentHour + 1) {
                const habitEndMinutes = (habitEndTime - currentHour) * 60
                const habitEndPosition = (habitEndMinutes / 60) * 100
                if (habitEndPosition > topPositionInSlot) {
                  topPositionInSlot = habitEndPosition
                }
              }
            })

            const taskHeight = (task.estimated_hours || 1) * 64
            const isPlaceholder = task.isPlaceholder || false
            const taskClassName = isPlaceholder 
              ? "absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-green-100 border-green-400 text-green-800 cursor-pointer hover:bg-green-200 shadow-sm"
              : "absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-yellow-100 border-yellow-400 text-yellow-800 cursor-pointer hover:bg-yellow-200 shadow-sm"

            return (
              <div
                key={`task-${task.id}`}
                className={taskClassName}
                style={getEventStyle(topPositionInSlot, taskHeight, 5)}
                onClick={e => {
                  e.stopPropagation()
                  handleTaskClick(task)
                }}
              >
                <div className="font-medium truncate flex-1">
                  {task.title}
                  {isPlaceholder && <span className="text-xs ml-1 opacity-60">💰</span>}
                </div>
                <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">
                  {task.estimated_hours}h
                </div>
              </div>
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
              <div
                key={`meeting-${meeting.id}`}
                className="absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-red-100 border-red-400 text-red-800 shadow-sm"
                style={getEventStyle(topPositionInSlot, meetingHeight, 15)}
                onClick={e => {
                  e.stopPropagation()
                  handleEditMeeting(meeting)
                }}
              >
                <div className="font-medium truncate flex-1">{meeting.title}</div>
                <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">
                  {Math.round(meetingDuration)}min
                </div>
              </div>
            )
          })}

          {/* Task Daily Logs */}
          {tasksDailyLogsInSlot.map(log => {
            // Use actual_duration if available, otherwise fall back to scheduled_duration
            const duration = log.estimated_hours || 1
            const logHeight = duration * 64

            return (
              <div
                key={`task-daily-log-${log.id}`}
                className="absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-yellow-100 border-yellow-400 text-yellow-800 cursor-pointer hover:opacity-100 shadow-sm"
                style={getEventStyle(log.topPosition, logHeight, 20)}
                onClick={e => {
                  e.stopPropagation()
                  handleTaskClick(log.tasks)
                }}
              >
                <div className="font-medium truncate flex-1">
                  {log.tasks?.title || 'Task Log'}
                  <div className="text-xs opacity-75">{log.tasks?.projects?.name || 'Project'}</div>
                </div>
                <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">{duration}h</div>
              </div>
            )
          })}

          {/* Buffer Time */}
          {buffersInSlot.map(buffer => {
            const bufferHeight = (buffer.duration / 60) * 64
            const bufferClassName = buffer.isReduced 
              ? "absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-orange-100 border-orange-400 text-orange-800 opacity-80 shadow-sm"
              : "absolute text-sm sm:text-xs p-1 sm:p-0.5 rounded border-l-2 flex items-start justify-between bg-indigo-100 border-indigo-400 text-indigo-800 shadow-sm"

            return (
              <div
                key={`buffer-${buffer.id}`}
                className={bufferClassName}
                style={getEventStyle(buffer.topPosition || 0, bufferHeight, 8)}
                title={`${buffer.title} - ${buffer.duration} minutes${buffer.isReduced ? ' (reduced due to same day)' : ''}`}
              >
                <div className="font-medium truncate flex-1">
                  {buffer.title}
                  {buffer.isReduced && <span className="text-xs ml-1 opacity-60">⏰</span>}
                </div>
                <div className="text-sm sm:text-xs opacity-75 ml-1 flex-shrink-0">
                  {buffer.duration}min
                </div>
              </div>
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
      tasksScheduled,
      handleHabitClick,
      handleTaskClick,
    ]
  )

  const { plannedHours, actualHours, actualHoursBreakdown, plannedHoursBreakdown } = useMemo(
    () => calculateWorkHours(scheduledTasksCache, allTasks, tasksScheduled, settings),
    [scheduledTasksCache, allTasks, tasksScheduled, settings]
  )

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
      <div className="bg-neutral-100 border-b border-neutral-200 px-2 py-0.5 sm:px-0 sm:py-1">
        {/* Navigation, Work Hours Label, and Planned/Actual all on one line */}
        <div className="flex items-center justify-between sm:px-2">
          {/* Left side: Navigation Controls */}
          <div className="flex items-center">
            <button
              onClick={navigateBackWeek}
              className=" hover:bg-neutral-200 rounded transition-colors"
              title="Go back 5 days"
            >
              <ChevronsLeft className="w-3 h-3 text-neutral-600" />
            </button>
            <button
              onClick={navigateBackDay}
              className="hover:bg-neutral-200 rounded transition-colors"
              title="Go back 1 day"
            >
              <ChevronLeft className="w-3 h-3 text-neutral-600" />
            </button>
            <button
              onClick={navigateForwardDay}
              className="hover:bg-neutral-200 rounded transition-colors"
              title="Go forward 1 day"
            >
              <ChevronRight className="w-3 h-3 text-neutral-600" />
            </button>
            <button
              onClick={navigateForwardWeek}
              className="hover:bg-neutral-200 rounded transition-colors"
              title="Go forward 5 days"
            >
              <ChevronsRight className="w-3 h-3 text-neutral-600" />
            </button>

            {/* Work Hours Label - desktop only */}
            <div className="hidden sm:block text-sm text-neutral-700 ml-2">
              Work Hours (until{' '}
              {settings?.week_ending_day?.charAt(0).toUpperCase() +
                settings?.week_ending_day?.slice(1) || 'Sunday'}{' '}
              {new Date(`1970-01-01T${settings?.week_ending_time || '20:30'}`).toLocaleTimeString(
                'en-US',
                {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }
              )}{' '}
              {settings?.week_ending_timezone?.split('/')[1]?.replace('_', ' ') || 'ET'})
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
                <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 shadow-lg rounded-md p-3 z-50">
                  <div className="text-sm font-medium text-neutral-900 mb-2">
                    Planned Hours Breakdown
                  </div>
                  {plannedHoursBreakdown.filter(
                    item => item.hourlyRate && Number(item.hourlyRate) > 0
                  ).length > 0 ? (
                    <div className="space-y-1">
                      {plannedHoursBreakdown
                        .filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
                        .map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <div className="flex-1">
                              <div className="font-medium text-neutral-900 flex items-center">
                                {item.projectName}
                                {item.isCompleted && (
                                  <span className="ml-2 text-green-600 text-xs">✓</span>
                                )}
                              </div>
                              <div className="text-neutral-600 truncate">{item.sessionName}</div>
                              <div className="text-neutral-600">
                                Due: {format(new Date(item.dueDate), 'MMM d')}
                              </div>
                              {item.hourlyRate && Number(item.hourlyRate) > 0 && (
                                <div className="text-neutral-500">
                                  ${Number(item.hourlyRate)}/hr
                                </div>
                              )}
                            </div>
                            <div className="text-neutral-900 font-medium">
                              {item.hours.toFixed(1)}h
                              {item.hourlyRate && Number(item.hourlyRate) > 0 && (
                                <div className="text-blue-600 text-xs">
                                  ${(item.hours * Number(item.hourlyRate)).toFixed(0)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
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
                      <div className="border-r border-neutral-300 py-0 px-1 sm:p-1 h-16 bg-neutral-50 flex items-start">
                        <div className="font-mono text-neutral-600 text-xs">{hour.display}</div>
                      </div>
                      {dayColumns.map((column, columnIndex) => {
                        const isInSelection = isInDragSelection(hourIndex, columnIndex)
                        
                        return (
                          <div
                            key={columnIndex}
                            className={`border-r border-neutral-300 last:border-r-0 p-1 sm:p-0.5 h-16 text-sm sm:text-xs relative cursor-pointer select-none hover:bg-neutral-50`}
                            onClick={() => !isDragging && handleTimeSlotClick(hour.time, column.date)}
                            onMouseDown={(e) => handleMouseDown(e, hour.time, column.date, hourIndex, columnIndex)}
                            onMouseEnter={(e) => handleMouseEnter(e, hour.time, column.date, hourIndex, columnIndex)}
                            onMouseMove={(e) => handleMouseMove(e, hour.time, column.date, hourIndex, columnIndex)}
                            style={{
                              userSelect: 'none'
                            }}
                          >
                            {/* Quarter-hour visual divisions */}
                            <div className="absolute inset-0 pointer-events-none">
                              {/* Quarter-hour dividing lines */}
                              {[1, 2, 3].map(quarter => (
                                <div
                                  key={`divider-${quarter}`}
                                  className="absolute left-0 right-0 h-px"
                                  style={{
                                    top: `${quarter * 25}%`,
                                    borderTop: '1px solid rgba(0,0,0,0.05)'
                                  }}
                                />
                              ))}
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
              
              const topPosition = (startHourIndex - virtualizedCalendar.visibleRange.start) * 64 + (startQuarter * 16)
              const endPosition = (endHourIndex - virtualizedCalendar.visibleRange.start) * 64 + ((endQuarter + 1) * 16)
              const height = endPosition - topPosition
              
              // Calculate column position
              const timeColumnWidth = `calc((100% - ${gridCols.split(' ')[0]}) / ${dayColumns.length})`
              const leftPosition = `calc(${gridCols.split(' ')[0]} + ${dragStart.columnIndex} * ${timeColumnWidth})`
              
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
                    borderRadius: '2px'
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
        isOpen={showMeetingModal}
        onClose={closeModal}
        meeting={newMeeting}
        onMeetingChange={setNewMeeting}
        onSubmit={handleCreateMeeting}
        selectedTimeSlot={selectedTimeSlot}
        editingMeeting={editingMeeting}
        onDelete={handleDeleteMeeting}
      />

      <CalendarTaskModal
        isOpen={showTaskModal}
        onClose={closeModal}
        task={selectedTask}
        onComplete={handleCompleteTaskWrapper}
        onDelete={handleDeleteTaskWrapper}
      />

      <HabitModal
        isOpen={showHabitModal}
        onClose={closeModal}
        habit={selectedHabit}
        selectedDate={selectedHabitDate}
        onTimeChange={handleHabitTimeChangeWithReset}
        onSkip={handleHabitSkipWithReset}
      />
    </div>
  )
}

export default memo(Calendar)
