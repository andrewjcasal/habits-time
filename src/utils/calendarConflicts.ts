import { format } from 'date-fns'
import { getEffectiveHabitStartTime } from './habitScheduling'
import { generateBuffersForDays, BufferTime } from './bufferManager'

export const computeConflictMaps = (
  habitsData: any[], 
  sessionsData: any[], 
  meetingsData: any[], 
  dayColumns: any[],
  tasksDailyLogsData: any[] = []
) => {
  const habitConflicts = new Map()
  const sessionConflicts = new Map()
  const meetingConflicts = new Map()
  const tasksDailyLogsConflicts = new Map()
  const bufferConflicts = new Map()

  // Pre-compute habit conflicts (exclude non-calendar habits)
  habitsData.filter(habit => habit.habits_types?.scheduling_rule !== 'non_calendar').forEach(habit => {
    dayColumns.forEach(({ dateStr }) => {
      const dailyLog = habit.habits_daily_logs?.find((log: any) => log.log_date === dateStr)
      const effectiveStartTime = getEffectiveHabitStartTime(habit, dateStr, dailyLog)
      
      if (effectiveStartTime) {
        const [hours, minutes] = effectiveStartTime.split(':').map(Number)
        const startTimeInHours = hours + minutes / 60
        const duration = dailyLog?.duration || habit.duration || 0
        const endTimeInHours = startTimeInHours + duration / 60
        
        // Check for meeting conflicts and adjust habit time
        let adjustedStartTime = startTimeInHours
        const conflictingMeeting = meetingsData.find(meeting => {
          const meetingStart = new Date(meeting.start_time)
          const meetingEnd = new Date(meeting.end_time)
          const meetingDateStr = format(meetingStart, 'yyyy-MM-dd')
          
          if (meetingDateStr !== dateStr) return false
          
          const meetingStartInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
          const meetingEndInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
          
          return startTimeInHours < meetingEndInHours && endTimeInHours > meetingStartInHours
        })
        
        if (conflictingMeeting) {
          const meetingEnd = new Date(conflictingMeeting.end_time)
          adjustedStartTime = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
        }
        
        // Check for session conflicts and adjust habit time (after meeting conflicts)
        const conflictingSession = sessionsData.find(session => {
          if (!session.actual_start_time || session.scheduled_date !== dateStr) return false
          
          const timeOnly = session.actual_start_time.split(/[+-]/)[0] // Remove timezone part
          const [sessionHours, sessionMinutes] = timeOnly.split(':').map(Number)
          const sessionStartInHours = sessionHours + sessionMinutes / 60
          const sessionDuration = (session.scheduled_hours || 1) // Duration in hours
          const sessionEndInHours = sessionStartInHours + sessionDuration
          
          // Check if habit conflicts with session (using adjusted start time from meeting conflicts)
          const habitEndInHours = adjustedStartTime + duration / 60
          return adjustedStartTime < sessionEndInHours && habitEndInHours > sessionStartInHours
        })
        
        if (conflictingSession) {
          const timeOnly = conflictingSession.actual_start_time.split(/[+-]/)[0]
          const [sessionHours, sessionMinutes] = timeOnly.split(':').map(Number)
          const sessionDuration = (conflictingSession.scheduled_hours || 1)
          const sessionEndInHours = sessionHours + sessionMinutes / 60 + sessionDuration
          adjustedStartTime = sessionEndInHours
        }
        
        const adjustedEndTime = adjustedStartTime + duration / 60
        
        
        // Mark all affected time slots in 15-minute increments
        // Use Math.round to avoid floating point precision issues
        const startSlot = Math.floor(adjustedStartTime * 4) / 4
        const endSlot = Math.ceil(adjustedEndTime * 4) / 4
        for (let time = startSlot; time < endSlot; time += 0.25) {
          const key = `${dateStr}-${time}`
          habitConflicts.set(key, habit)
          
        }
      }
    })
  })
  
  // Pre-compute session conflicts
  sessionsData.forEach(session => {
    if (session.actual_start_time && session.scheduled_date) {
      // Handle timezone-aware time formats like "13:00:00+00" or "13:00:00-05"
      const timeOnly = session.actual_start_time.split(/[+-]/)[0] // Remove timezone part
      const [hours, minutes] = timeOnly.split(':').map(Number)
      const startTimeInHours = hours + minutes / 60
      const duration = session.session_duration || 2 // Default to 2 hours based on your data
      const endTimeInHours = startTimeInHours + duration
      
      for (let time = Math.floor(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
        const key = `${session.scheduled_date}-${time}`
        sessionConflicts.set(key, session)
      }
    }
  })
  
  // Pre-compute meeting conflicts
  meetingsData.forEach(meeting => {
    const meetingStart = new Date(meeting.start_time)
    const meetingEnd = new Date(meeting.end_time)
    const dateStr = format(meetingStart, 'yyyy-MM-dd')
    
    const startTimeInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
    const endTimeInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
    
    for (let time = Math.floor(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
      const key = `${dateStr}-${time}`
      meetingConflicts.set(key, meeting)
    }
  })
  
  // Pre-compute task daily logs conflicts
  tasksDailyLogsData.forEach(log => {
    if (log.log_date) {
      // Use actual_start_time if available, otherwise fall back to scheduled_start_time
      const startTime = log.actual_start_time || log.scheduled_start_time
      if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number)
        const startTimeInHours = hours + minutes / 60
        // Use actual_duration if available, otherwise fall back to estimated_hours or default to 1
        const duration = log.actual_duration || log.scheduled_duration || log.estimated_hours || 1
        const endTimeInHours = startTimeInHours + duration
        
        for (let time = Math.floor(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
          const key = `${log.log_date}-${time}`
          tasksDailyLogsConflicts.set(key, log)
        }
      }
    }
  })
  
  // Pre-compute buffer conflicts
  const buffers = generateBuffersForDays(dayColumns, meetingsData)
  buffers.forEach((buffer: BufferTime, dateStr: string) => {
    if (buffer.isActive) {
      const [hours, minutes] = buffer.startTime.split(':').map(Number)
      const startTimeInHours = hours + minutes / 60
      const durationInHours = buffer.duration / 60
      const endTimeInHours = startTimeInHours + durationInHours
      
      // Mark all affected time slots in 15-minute increments
      for (let time = Math.floor(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
        const key = `${dateStr}-${time}`
        bufferConflicts.set(key, buffer)
      }
    }
  })
  
  return { habitConflicts, sessionConflicts, meetingConflicts, tasksDailyLogsConflicts, bufferConflicts }
}