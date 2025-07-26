import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useCalendarData } from '../hooks/useCalendarData'
import { useTasks } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { useVirtualizedCalendar } from '../hooks/useVirtualizedCalendar'
import { Meeting } from '../types'
import MeetingModal from '../components/MeetingModal'
import CalendarTaskModal from '../components/CalendarTaskModal'
import HabitModal from '../components/HabitModal'

const Calendar = () => {
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
  const [baseDate, setBaseDate] = useState(new Date())
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
  const [tasks, setTasks] = useState<any[]>([]) // Tasks with project data
  const {
    dayColumns,
    hourSlots,
    getCurrentTimeLinePosition,
    habits,
    sessions,
    meetings,
    currentTime,
    getTasksForTimeSlot,
    tasksScheduled,
    setTasksScheduled,
    setScheduledTasksCache,
    scheduledTasksCache,
    addMeeting,
    updateMeeting,
    deleteMeeting,
  } = useCalendarData(windowWidth, baseDate)

  // Virtual scrolling for performance
  const virtualizedCalendar = useVirtualizedCalendar(hourSlots.length, {
    itemHeight: 64, // h-16 = 64px
    containerHeight,
    overscan: 3
  })

  const gridCols =
    windowWidth > 1350
      ? '80px 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
      : windowWidth > 850
      ? '80px 1fr 1fr 1fr 1fr 1fr 1fr 1fr'
      : '80px 1fr 1fr 1fr'

  // Navigation functions
  const navigateBackWeek = () => {
    setBaseDate(prevDate => new Date(prevDate.getTime() - 7 * 24 * 60 * 60 * 1000))
  }

  const navigateBackDay = () => {
    setBaseDate(prevDate => new Date(prevDate.getTime() - 24 * 60 * 60 * 1000))
  }

  const navigateForwardDay = () => {
    setBaseDate(prevDate => new Date(prevDate.getTime() + 24 * 60 * 60 * 1000))
  }

  const navigateForwardWeek = () => {
    setBaseDate(prevDate => new Date(prevDate.getTime() + 7 * 24 * 60 * 60 * 1000))
  }

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

  // Fetch all tasks with project data
  useEffect(() => {
    const fetchAllTasks = async () => {
      try {
        const { supabase } = await import('../lib/supabase')
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('tasks')
          .select(
            `
            *,
            projects (
              id,
              name,
              hourly_rate
            )
          `
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setTasks(data || [])
      } catch (error) {
        console.error('Error fetching tasks:', error)
      }
    }

    fetchAllTasks()
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

      // Reset task scheduling to recalculate available slots with new/updated meeting
      setTasksScheduled(false)
      setScheduledTasksCache(new Map())

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
      
      // Reset task scheduling to recalculate available slots without deleted meeting
      setTasksScheduled(false)
      setScheduledTasksCache(new Map())
      
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

  const handleHabitTimeChange = async (habitId: string, date: string, newTime: string) => {
    try {
      const { supabase } = await import('../lib/supabase')
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Insert or update the daily log with the new scheduled start time
      const { error } = await supabase.from('habits_daily_logs').upsert(
        {
          habit_id: habitId,
          user_id: user.id,
          log_date: date,
          scheduled_start_time: newTime,
        },
        {
          onConflict: 'habit_id,user_id,log_date',
        }
      )

      if (error) throw error

      // Reset task scheduling to recalculate available slots with new habit time
      setTasksScheduled(false)
      setScheduledTasksCache(new Map())
    } catch (error) {
      console.error('Error updating habit time:', error)
      throw error
    }
  }

  const handleCompleteTask = async () => {
    if (!selectedTask) return
    try {
      const { supabase } = await import('../lib/supabase')
      const originalTaskId = selectedTask.id.includes('-chunk-')
        ? selectedTask.id.split('-chunk-')[0]
        : selectedTask.id

      const { error } = await supabase
        .from('tasks')
        .update({ is_complete: true })
        .eq('id', originalTaskId)

      if (error) throw error
      window.location.reload()
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  const handleDeleteTask = async () => {
    if (!selectedTask) return
    try {
      const { supabase } = await import('../lib/supabase')
      const originalTaskId = selectedTask.id.includes('-chunk-')
        ? selectedTask.id.split('-chunk-')[0]
        : selectedTask.id

      const { error } = await supabase.from('tasks').delete().eq('id', originalTaskId)
      if (error) throw error
      window.location.reload()
    } catch (error) {
      console.error('Error deleting task:', error)
    }
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
  const getEventStyle = (topPosition: number, height: number, zIndex: number = 5) => ({
    left: '0',
    width: '93%',
    top: `${topPosition}%`,
    height: `${height - 2}px`, // Reduce height by 2px for separation
    zIndex,
  })

  // Get meetings for a specific time slot
  const getMeetingsForTimeSlot = useCallback((timeSlot: string, date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    const currentHour = parseInt(timeSlot.split(':')[0])

    return meetings.filter(meeting => {
      const meetingStart = new Date(meeting.start_time)
      const meetingDate = format(meetingStart, 'yyyy-MM-dd')
      const meetingHour = meetingStart.getHours()

      return meetingDate === dateKey && meetingHour === currentHour
    })
  }, [meetings])

  // Get habits for a specific time slot
  const getHabitsForTimeSlot = useCallback((timeSlot: string, date: Date) => {
    const currentHour = parseInt(timeSlot.split(':')[0])
    const dateKey = format(date, 'yyyy-MM-dd')

    return habits
      .filter(habit => {
        // Check if there's a daily log with a scheduled start time for this date
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateKey)
        const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time

        if (!effectiveStartTime) return false

        const habitStartHour = parseInt(effectiveStartTime.split(':')[0])
        const habitStartMinute = parseInt(effectiveStartTime.split(':')[1])

        // Check for meeting conflicts and rescheduling
        const conflictingMeeting = meetings.find(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')

          if (meetingDateStr !== dateKey) return false

          const habitDuration = habit.duration || 0
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

          const habitDuration = habit.duration || 0
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
        // Use the same effective start time logic as in the filter
        const dailyLog = habit.habits_daily_logs?.find(log => log.log_date === dateKey)
        const effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time

        const habitStartHour = parseInt(effectiveStartTime!.split(':')[0])
        const habitStartMinute = parseInt(effectiveStartTime!.split(':')[1])

        // Check for rescheduling (meetings first, then sessions)
        const conflictingMeeting = meetings.find(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')

          if (meetingDateStr !== dateKey) return false

          const habitDuration = habit.duration || 0
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

          const habitDuration = habit.duration || 0
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
  }, [habits, meetings, sessions])

  // Get sessions for a specific time slot
  const getSessionsForTimeSlot = useCallback((timeSlot: string, date: Date) => {
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
  }, [sessions])

  // Render all calendar events for a time slot
  const renderCalendarEvents = useCallback((timeSlot: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    const habitsInSlot = getHabitsForTimeSlot(timeSlot, date)
    const sessionsInSlot = getSessionsForTimeSlot(timeSlot, date)
    const meetingsInSlot = getMeetingsForTimeSlot(timeSlot, date)
    const tasksInSlot = tasksScheduled ? getTasksForTimeSlot(timeSlot, date) : []
    
    // Log performance data for each time slot with blocks
    const totalBlocks = habitsInSlot.length + sessionsInSlot.length + meetingsInSlot.length + tasksInSlot.length
    if (totalBlocks > 0) {
      console.log(`📅 Time Slot ${dateStr} ${timeSlot}:`, {
        totalBlocks,
        habits: { count: habitsInSlot.length },
        sessions: { count: sessionsInSlot.length },
        meetings: { count: meetingsInSlot.length },
        tasks: { count: tasksInSlot.length }
      })
    }

    return (
      <>
        {/* Habits */}
        {habitsInSlot.map(habit => {
          const habitHeight = habit.duration ? (habit.duration / 60) * 64 : 64
          const isRescheduled = habit.isRescheduled || false
          
          console.log(`🔵 Rendering Habit: ${habit.name} at ${timeSlot}`)

          return (
            <div
              key={`habit-${habit.id}`}
              className={`absolute text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-blue-50 border-blue-400 text-blue-800 cursor-pointer hover:bg-blue-100 transition-colors`}
              style={getEventStyle(habit.topPosition, habitHeight)}
              onClick={e => {
                e.stopPropagation()
                handleHabitClick(habit, date)
              }}
            >
              <div className="font-medium truncate flex-1 flex items-center">
                {isRescheduled && <Clock className="w-2.5 h-2.5 mr-1 flex-shrink-0" />}
                {habit.name}
              </div>
              {habit.duration && (
                <div className="text-xs opacity-75 ml-1 flex-shrink-0">{habit.duration}min</div>
              )}
            </div>
          )
        })}

        {/* Sessions */}
        {sessionsInSlot.map(session => {
          const sessionHeight = session.scheduled_hours * 64
          
          console.log(`🟣 Rendering Session: ${session.projects?.name} at ${timeSlot}`)

          return (
            <div
              key={`session-${session.id}`}
              className="absolute text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-purple-50 border-purple-400 text-purple-800"
              style={getEventStyle(session.topPosition, sessionHeight, 10)}
            >
              <div className="font-medium truncate flex-1">
                {session.projects?.name || 'Project Session'}
              </div>
              <div className="text-xs opacity-75 ml-1 flex-shrink-0">
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
          const topPositionInSlot = (minutesIntoHour / 60) * 100
          const taskHeight = (task.estimated_hours || 1) * 64
          
          console.log(`🟡 Rendering Task: ${task.title} at ${timeSlot}`)

          return (
            <div
              key={`task-${task.id}`}
              className="absolute text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-yellow-50 border-yellow-400 text-yellow-800 opacity-75 cursor-pointer hover:opacity-100"
              style={getEventStyle(topPositionInSlot, taskHeight, 5)}
              onClick={e => {
                e.stopPropagation()
                handleTaskClick(task)
              }}
            >
              <div className="font-medium truncate flex-1">{task.title}</div>
              <div className="text-xs opacity-75 ml-1 flex-shrink-0">{task.estimated_hours}h</div>
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
          
          console.log(`🟢 Rendering Meeting: ${meeting.title} at ${timeSlot}`)

          return (
            <div
              key={`meeting-${meeting.id}`}
              className="absolute text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-red-50 border-red-400 text-red-800"
              style={getEventStyle(topPositionInSlot, meetingHeight, 15)}
              onClick={e => {
                e.stopPropagation()
                handleEditMeeting(meeting)
              }}
            >
              <div className="font-medium truncate flex-1">{meeting.title}</div>
              <div className="text-xs opacity-75 ml-1 flex-shrink-0">
                {Math.round(meetingDuration)}min
              </div>
            </div>
          )
        })}
      </>
    )
  }, [getHabitsForTimeSlot, getSessionsForTimeSlot, getMeetingsForTimeSlot, getTasksForTimeSlot, tasksScheduled, handleHabitClick, handleTaskClick])

  // Calculate planned vs actual work hours up to configured week ending time
  const calculateWorkHours = () => {
    const now = new Date()

    // Get week ending configuration from settings
    const weekEndingDay = settings?.week_ending_day || 'sunday'
    const weekEndingTime = settings?.week_ending_time || '20:30'
    const weekEndingTimezone = settings?.week_ending_timezone || 'America/New_York'

    // Calculate days until week ending day
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDayIndex = dayNames.indexOf(weekEndingDay)
    const currentDayIndex = now.getDay()
    const daysUntilTarget = (targetDayIndex - currentDayIndex + 7) % 7

    const weekEndDate = new Date(now)
    weekEndDate.setDate(now.getDate() + daysUntilTarget)

    // Set to configured time
    const [hours, minutes] = weekEndingTime.split(':').map(Number)
    weekEndDate.setHours(hours, minutes, 0, 0)

    let plannedHours = 0
    let actualHours = 0
    const actualHoursBreakdown: Array<{
      sessionName: string
      projectName: string
      hours: number
      date: string
      hourlyRate?: number
    }> = []
    const plannedHoursBreakdown: Array<{
      sessionName: string
      projectName: string
      hours: number
      dueDate: string
      hourlyRate?: number
      isCompleted: boolean
    }> = []

    // Calculate from scheduled task chunks up to the cutoff time
    console.log('123 - scheduledTasksCache:', scheduledTasksCache)
    console.log('123 - tasksScheduled:', tasksScheduled)

    scheduledTasksCache.forEach((chunks, dateKey) => {
      console.log('123 - Processing date:', dateKey, 'chunks:', chunks)
      const chunkDate = new Date(dateKey + 'T00:00:00')

      chunks.forEach(chunk => {
        // The chunk has the task data directly, extract the original task ID
        const originalTaskId = chunk.id.split('-chunk-')[0]

        // Calculate chunk end time
        const chunkStartHour = chunk.startTime ? Math.floor(chunk.startTime) : chunk.startHour
        const chunkStartMinute = chunk.startTime ? (chunk.startTime % 1) * 60 : 0
        const chunkDateTime = new Date(chunkDate)
        chunkDateTime.setHours(chunkStartHour, chunkStartMinute, 0, 0)

        // Add chunk duration to get end time (use estimated_hours from chunk)
        const chunkEndTime = new Date(chunkDateTime)
        chunkEndTime.setHours(chunkEndTime.getHours() + Math.floor(chunk.estimated_hours))
        chunkEndTime.setMinutes(chunkEndTime.getMinutes() + (chunk.estimated_hours % 1) * 60)


        // Include chunks that start before the cutoff (partial or full)
        if (chunkDateTime < weekEndDate) {
          const task = tasks.find(t => t.id === originalTaskId)
          if (task && task.is_billable) {
            // Calculate actual hours to include (partial if chunk crosses cutoff)
            let hoursToInclude = chunk.estimated_hours
            if (chunkEndTime > weekEndDate) {
              // Chunk crosses cutoff, only include hours up to cutoff
              const timeDiff = weekEndDate.getTime() - chunkDateTime.getTime()
              hoursToInclude = timeDiff / (1000 * 60 * 60) // Convert milliseconds to hours
            }
            
            // Only include chunks with hourly rates > 0 in planned hours
            if (task.projects?.hourly_rate && Number(task.projects.hourly_rate) > 0) {
              plannedHours += hoursToInclude
            }

            // Add to planned breakdown
            plannedHoursBreakdown.push({
              sessionName: `${task.title} (${chunkStartHour}:${chunkStartMinute
                .toString()
                .padStart(2, '0')})`,
              projectName: task.projects?.name || 'Project',
              hours: hoursToInclude,
              dueDate: dateKey,
              hourlyRate: task.projects?.hourly_rate || 0,
              isCompleted: task.is_complete,
            })

            // Only count actual hours for completed work
            if (task.is_complete) {
              actualHours += hoursToInclude
              actualHoursBreakdown.push({
                sessionName: `${task.title} (${chunkStartHour}:${chunkStartMinute
                  .toString()
                  .padStart(2, '0')})`,
                projectName: task.projects?.name || 'Project',
                hours: hoursToInclude,
                date: dateKey,
                hourlyRate: task.projects?.hourly_rate || 0,
              })
            }
          }
        }
      })
    })

    return { plannedHours, actualHours, actualHoursBreakdown, plannedHoursBreakdown }
  }

  const { plannedHours, actualHours, actualHoursBreakdown, plannedHoursBreakdown } =
    calculateWorkHours()

  console.log(
    'time',
    plannedHoursBreakdown.filter(item => item.hourlyRate && Number(item.hourlyRate) > 0)
  )

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top Bar with Navigation and Work Hours */}
      <div className="bg-neutral-100 border-b border-neutral-200 px-1 py-1 flex items-center justify-between">
        <div className="flex items-center">
          {/* Navigation Controls */}
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
          </div>

          {/* Work Hours Label */}
          <div className="text-sm text-neutral-700 ml-2">
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
                              <div className="text-neutral-500">${Number(item.hourlyRate)}/hr</div>
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
          <div className="text-sm relative actual-hours-tooltip">
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

      {/* Headers */}
      <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: gridCols }}>
        <div className="bg-neutral-100 border-r border-neutral-200 flex items-center justify-center">
          <button
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
            title="Add meeting"
            onClick={handleAddMeeting}
          >
            <Plus className="w-3 h-3 text-neutral-600" />
          </button>
        </div>
        {dayColumns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="p-1.5 bg-neutral-50 border-r border-neutral-200 last:border-r-0"
          >
            <h2 className="text-sm font-medium text-neutral-900">{column.label}</h2>
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
              right: 0
            }}
          >
            {hourSlots
              .slice(virtualizedCalendar.visibleRange.start, virtualizedCalendar.visibleRange.end)
              .map((hour, index) => {
                const hourIndex = virtualizedCalendar.visibleRange.start + index
                
                console.log(`⏰ Rendering Time Slot ${hour.time} (index: ${hourIndex})`)
                
                const timeSlotDiv = (
                  <div
                    key={hourIndex}
                    className="grid border-b border-neutral-100"
                    style={{ 
                      gridTemplateColumns: gridCols,
                      height: virtualizedCalendar.itemHeight
                    }}
                  >
                    <div className="border-r border-neutral-200 p-1 h-16 bg-neutral-50 flex items-start">
                      <div className="font-mono text-neutral-600 text-xs">{hour.display}</div>
                    </div>
                    {dayColumns.map((column, columnIndex) => (
                      <div
                        key={columnIndex}
                        className="border-r border-neutral-200 last:border-r-0 p-0.5 h-16 text-xs hover:bg-neutral-50 relative cursor-pointer"
                        onClick={() => handleTimeSlotClick(hour.time, column.date)}
                      >
                        {/* Render calendar events */}
                        {renderCalendarEvents(hour.time, column.date)}
                      </div>
                    ))}
                  </div>
                )
                
                console.log(`✅ Completed Time Slot ${hour.time} render`)
                
                return timeSlotDiv
              })}
          </div>
        </div>

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
        onComplete={handleCompleteTask}
        onDelete={handleDeleteTask}
      />

      <HabitModal
        isOpen={showHabitModal}
        onClose={closeModal}
        habit={selectedHabit}
        selectedDate={selectedHabitDate}
        onTimeChange={handleHabitTimeChange}
      />
    </div>
  )
}

export default Calendar
