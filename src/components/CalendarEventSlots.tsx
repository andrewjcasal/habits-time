import React from 'react'
import { Clock } from 'lucide-react'
import CalendarEvent from './CalendarEvent'
import CalendarNotePin from './CalendarNotePin'

// Helper function to format duration without rounding quarter hours
const formatDuration = (duration: number): string => {
  if (duration % 1 === 0) return duration.toString()
  if (duration === 0.25) return '0.25'
  if (duration === 0.5) return '0.5'
  if (duration === 0.75) return '0.75'
  return duration.toString()
}

// Common styles for all calendar events
const getEventStyle = (
  topPosition: number,
  height: number,
  zIndex: number = 5,
  leftOffset: number = 0,
  widthFraction: number = 1
): React.CSSProperties => ({
  left: `${leftOffset}%`,
  width: `${93 * widthFraction}%`,
  top: `${topPosition}%`,
  height: `${height - 2}px`, // Reduce height by 2px for separation
  zIndex,
})

interface CalendarEventSlotsProps {
  habitsInSlot: any[]
  sessionsInSlot: any[]
  meetingsInSlot: any[]
  buffersInSlot: any[]
  tasksInSlot: any[]
  tasksDailyLogsInSlot: any[]
  categoryBuffersInSlot: any[]
  timeSlot: string
  date: Date
  dateStr: string
  baseItemHeight: number
  handleHabitClick: (habit: any, date: Date) => void
  handleSessionClick: (session: any) => void
  handleTaskClick: (task: any) => void
  handleEditMeeting: (meeting: any) => void
  getNotesForDateTime: (date: Date, timeSlot: string) => any[]
  removeCalendarNote: (noteId: string) => void
}

export default function CalendarEventSlots({
  habitsInSlot,
  sessionsInSlot,
  meetingsInSlot,
  buffersInSlot,
  tasksInSlot,
  tasksDailyLogsInSlot,
  categoryBuffersInSlot,
  timeSlot,
  date,
  dateStr,
  baseItemHeight,
  handleHabitClick,
  handleSessionClick,
  handleTaskClick,
  handleEditMeeting,
  getNotesForDateTime,
  removeCalendarNote,
}: CalendarEventSlotsProps) {
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
            duration={
              effectiveDuration > 0 ? `${formatDuration(effectiveDuration / 60)}h` : undefined
            }
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
            title={`${
              categoryBuffer.category_name
            } Buffer - ${categoryBuffer.remaining_hours.toFixed(1)} hours remaining this week`}
            eventTitle={categoryBuffer.category_name}
            subtitle="Buffer Time"
            duration={`${formatDuration(categoryBuffer.duration)}h`}
          />
        )
      })}

      {/* Calendar Note Pins */}
      {getNotesForDateTime(date, timeSlot).map(note => {
        const pinnedTime = new Date(note.pinned_date)
        const minutesIntoHour = pinnedTime.getMinutes()
        const topPositionInSlot = (minutesIntoHour / 60) * 100

        return (
          <CalendarNotePin
            key={`note-pin-${note.id}`}
            note={note}
            style={{
              top: `${topPositionInSlot}%`,
              right: '4px',
              zIndex: 35,
            }}
            onRemove={removeCalendarNote}
          />
        )
      })}
    </>
  )
}