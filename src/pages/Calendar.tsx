import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, Clock } from 'lucide-react'
import { useCalendarData } from '../hooks/useCalendarData'
import { useMeetings } from '../hooks/useMeetings'
import { Meeting } from '../types'
import MeetingModal from '../components/MeetingModal'
import CalendarTaskModal from '../components/CalendarTaskModal'

const Calendar = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ time: string; date: Date } | null>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    meeting_type: 'general' as Meeting['meeting_type'],
    priority: 'medium' as Meeting['priority'],
  })

  const { addMeeting, updateMeeting } = useMeetings()
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
  } = useCalendarData(windowWidth)

  const gridCols = windowWidth > 850 ? '80px 1fr 1fr 1fr 1fr 1fr' : '80px 1fr 1fr 1fr'

  // Listen for window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
      const baseDate = selectedTimeSlot?.date || (editingMeeting ? new Date(editingMeeting.start_time) : new Date())
      const [startHour, startMinute] = newMeeting.start_time.split(':').map(Number)
      const [endHour, endMinute] = newMeeting.end_time.split(':').map(Number)

      const startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMinute)
      const endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute)

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

      setNewMeeting({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
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

  const handleTaskClick = (task: any) => {
    setSelectedTask(task)
    setShowTaskModal(true)
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
    setSelectedTimeSlot(null)
    setEditingMeeting(null)
    setSelectedTask(null)
  }

  // Common styles for all calendar events
  const getEventStyle = (topPosition: number, height: number, zIndex: number = 5) => ({
    left: '0',
    width: '90%',
    top: `${topPosition}%`,
    height: `${height}px`,
    zIndex,
  })

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

    return habits.filter(habit => {
      if (!habit.current_start_time) return false
      
      const habitStartHour = parseInt(habit.current_start_time.split(':')[0])
      const habitStartMinute = parseInt(habit.current_start_time.split(':')[1])
      
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

      if (conflictingMeeting) {
        const meetingEnd = new Date(conflictingMeeting.end_time)
        const newStartHour = meetingEnd.getHours() + (meetingEnd.getMinutes() > 30 ? 1 : 0)
        return newStartHour === currentHour
      }

      return habitStartHour === currentHour
    }).map(habit => {
      const habitStartHour = parseInt(habit.current_start_time!.split(':')[0])
      const habitStartMinute = parseInt(habit.current_start_time!.split(':')[1])
      
      // Check for rescheduling
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

      if (conflictingMeeting) {
        const meetingEnd = new Date(conflictingMeeting.end_time)
        const newStartMinute = meetingEnd.getMinutes() === 0 ? 0 : meetingEnd.getMinutes() <= 30 ? 30 : 0
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

    return sessions.filter(session => {
      if (!session.actual_start_time || session.scheduled_date !== dateStr) return false
      const sessionStartHour = parseInt(session.actual_start_time.split(':')[0])
      return sessionStartHour === currentHour
    }).map(session => {
      const minutes = parseInt(session.actual_start_time!.split(':')[1])
      return {
        ...session,
        topPosition: (minutes / 60) * 100,
      }
    })
  }

  // Render all calendar events for a time slot
  const renderCalendarEvents = (timeSlot: string, date: Date) => {
    const habitsInSlot = getHabitsForTimeSlot(timeSlot, date)
    const sessionsInSlot = getSessionsForTimeSlot(timeSlot, date)
    const meetingsInSlot = getMeetingsForTimeSlot(timeSlot, date)
    const tasksInSlot = tasksScheduled ? getTasksForTimeSlot(timeSlot, date) : []

    return (
      <>
        {/* Habits */}
        {habitsInSlot.map(habit => {
          const habitHeight = habit.duration ? (habit.duration / 60) * 64 : 64
          const isRescheduled = habit.isRescheduled || false

          return (
            <div
              key={`habit-${habit.id}`}
              className={`absolute text-xs p-0.5 rounded border-l-2 flex items-start justify-between bg-blue-50 border-blue-400 text-blue-800`}
              style={getEventStyle(habit.topPosition, habitHeight)}
            >
              <div className="font-medium truncate flex-1 flex items-center">
                {isRescheduled && <Clock className="w-2.5 h-2.5 mr-1 flex-shrink-0" />}
                {habit.name}
              </div>
              {habit.duration && (
                <div className="text-xs opacity-75 ml-1 flex-shrink-0">
                  {habit.duration}min
                </div>
              )}
            </div>
          )
        })}

        {/* Sessions */}
        {sessionsInSlot.map(session => {
          const sessionHeight = session.scheduled_hours * 64

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
              <div className="text-xs opacity-75 ml-1 flex-shrink-0">
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
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Headers */}
      <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: gridCols }}>
        <div className="p-1.5 bg-neutral-100 border-r border-neutral-200 flex items-center justify-center">
          <button
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
            title="Add meeting"
            onClick={handleAddMeeting}
          >
            <Plus className="w-4 h-4 text-neutral-600" />
          </button>
        </div>
        {dayColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="p-1.5 bg-neutral-50 border-r border-neutral-200 last:border-r-0">
            <h2 className="text-sm font-medium text-neutral-900">{column.label}</h2>
            <p className="text-xs text-neutral-600">{format(column.date, 'MMM d, yyyy')}</p>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto relative">
        {hourSlots.map((hour, hourIndex) => (
          <div key={hourIndex} className="grid border-b border-neutral-100" style={{ gridTemplateColumns: gridCols }}>
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
        ))}
        
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
                    className={`relative ${dayIndex === columnIndex ? 'bg-red-500' : 'bg-transparent'}`}
                    style={{
                      height: '2px',
                      boxShadow: dayIndex === columnIndex ? '0 0 4px rgba(239, 68, 68, 0.5)' : 'none'
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
      />

      <CalendarTaskModal
        isOpen={showTaskModal}
        onClose={closeModal}
        task={selectedTask}
        onComplete={handleCompleteTask}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}

export default Calendar