import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Plus, Info, MapPin } from 'lucide-react'
import { useCalendarData } from '../hooks/useCalendarData'
import { useCalendarNotes } from '../hooks/useCalendarNotes'
import { Meeting } from '../types'
import MeetingModal from '../components/MeetingModal'
import CalendarTaskModal from '../components/CalendarTaskModal'
import HabitModal from '../components/HabitModal'
import SessionEditModal from '../components/SessionEditModal'
import CalendarNoteModal from '../components/CalendarNoteModal'
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
  onSetSaveHandler: (
    handler: (e: React.FormEvent, updatedMeeting: any, editingMeeting?: Meeting) => Promise<void>
  ) => void
  onSetDeleteHandler: (handler: (meeting: Meeting) => Promise<void>) => void
}

const CalendarContent = ({ onSetSaveHandler, onSetDeleteHandler }: CalendarContentProps) => {

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
  const [showTaskScheduleModal, setShowTaskScheduleModal] = useState(false)
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

  // Calendar notes state
  const [showCalendarNoteModal, setShowCalendarNoteModal] = useState(false)
  const [selectedNoteTimeSlot, setSelectedNoteTimeSlot] = useState<{
    time: string
    date: Date
  } | null>(null)

  // Calendar notes hook
  const {
    calendarNotes,
    habitNotes,
    addCalendarNote,
    addHabitNote,
    removeCalendarNote,
    getNotesForDateTime,
  } = useCalendarNotes()

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

  const handleTimeSlotContextMenu = (event: React.MouseEvent, timeSlot: string, date: Date) => {
    event.preventDefault() // Prevent browser context menu
    setSelectedNoteTimeSlot({ time: timeSlot, date })
    setShowCalendarNoteModal(true)
  }

  const handleSaveMeeting = async (
    e: React.FormEvent,
    updatedMeeting: typeof newMeeting,
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
    setShowCalendarNoteModal(false)
    setSelectedTimeSlot(null)
    setSelectedNoteTimeSlot(null)
    setEditingMeeting(null)
    setSelectedTask(null)
    setSelectedHabit(null)
    setSelectedHabitDate(null)
    setSelectedSession(null)
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
    console.log('Mouse up:', { isDragging, dragStart, dragEnd, timeSlot, hourIndex })
    
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

        // Calculate positions (same as drag overlay)
        const startHourIndex = Math.floor(minQuarters / 4)
        const startQuarter = minQuarters % 4
        const endHourIndex = Math.floor(maxQuarters / 4)
        const endQuarter = maxQuarters % 4

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
          openMeetingModal({ time: startTime, date: dragStart.date, endTime: endTime })
        }
      }
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
          getNotesForDateTime={getNotesForDateTime}
          removeCalendarNote={removeCalendarNote}
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
      tasksScheduled,
      handleHabitClick,
      handleTaskClick,
      getNotesForDateTime,
      removeCalendarNote,
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
          <button
            className="p-0.5 hover:bg-neutral-200 rounded transition-colors"
            title="Pin note"
            onClick={() => {
              // Default to today at current time if no specific slot selected
              const now = new Date()
              setSelectedNoteTimeSlot({
                time: format(now, 'HH:mm'),
                date: now,
              })
              setShowCalendarNoteModal(true)
            }}
          >
            <MapPin className="w-3 h-3 text-red-600" />
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

      {/* Calendar Grid */}
      <CalendarGrid
        containerRef={containerRef}
        hourSlots={hourSlots}
        gridCols={gridCols}
        dayColumns={dayColumns}
        renderCalendarEvents={renderCalendarEvents}
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

      <MeetingModal
        onTaskLogCreated={async () => {
          // Refresh calendar data when a task log is created
          window.location.reload()
        }}
        onBackToTask={
          selectedTask
            ? () => {
                // Go back to task modal from meeting modal
                setShowMeetingModal(false)
                setShowTaskModal(true)
              }
            : undefined
        }
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
            const taskDate = new Date(
              selectedTask.startTime ? selectedTask.startTime * 60 * 60 * 1000 : Date.now()
            )
            const timeSlot = selectedTask.startTime
              ? `${Math.floor(selectedTask.startTime).toString().padStart(2, '0')}:${(
                  (selectedTask.startTime % 1) *
                  60
                )
                  .toString()
                  .padStart(2, '0')}`
              : '09:00'

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

      <HabitModal onTimeChange={handleHabitTimeChangeWithReset} onSkip={handleHabitSkipWithReset} />

      <CalendarNoteModal
        isOpen={showCalendarNoteModal}
        onClose={closeModal}
        selectedDate={selectedNoteTimeSlot?.date}
        selectedTime={selectedNoteTimeSlot?.time}
        onAddNote={addHabitNote}
        onPinNote={addCalendarNote}
        habitNotes={habitNotes}
        existingNotes={calendarNotes}
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

      <TaskScheduleModal
        showTaskScheduleModal={showTaskScheduleModal}
        setShowTaskScheduleModal={setShowTaskScheduleModal}
        scheduledTasksCache={scheduledTasksCache}
        allTasks={allTasks}
        tasksDailyLogs={tasksDailyLogs}
      />
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
