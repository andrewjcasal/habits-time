import { format } from 'date-fns'
import { generateBuffersForDays, BufferTime } from './bufferManager'
import { resolveHabitPlacements } from './habitPlacement'

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

  // Get valid date strings for current view to filter conflicts
  const validDateStrs = new Set(dayColumns.map(({ dateStr }) => dateStr))

  // Pre-compute habit conflicts using the shared placement resolver so the
  // task scheduler sees habits in their *rendered* positions (after
  // meeting/session bumping + habit-vs-habit cascading), not at their raw
  // log times. Without this the scheduler would park a task in a slot that
  // the UI actually shows a habit in.
  const habitById = new Map<string, any>(habitsData.map(h => [h.id, h]))
  const placements = resolveHabitPlacements(
    habitsData.filter(h => h.habits_types?.scheduling_rule !== 'non_calendar'),
    meetingsData,
    sessionsData,
    dayColumns
  )
  for (const p of placements) {
    const startSlot = Math.round(p.start * 4) / 4
    const endSlot = Math.round(p.end * 4) / 4
    const habit = habitById.get(p.habitId) || { id: p.habitId }
    for (let time = startSlot; time < endSlot; time += 0.25) {
      const normalizedTime = Math.round(time * 4) / 4
      const key = `${p.dateKey}-${normalizedTime}`
      habitConflicts.set(key, habit)
    }
  }
  
  // Pre-compute session conflicts (only for dates in current view)
  sessionsData.forEach(session => {
    if (session.actual_start_time && session.scheduled_date) {
      // Only process sessions for dates in current view
      if (!validDateStrs.has(session.scheduled_date)) return
      
      // Handle timezone-aware time formats like "13:00:00+00" or "13:00:00-05"
      const timeOnly = session.actual_start_time.split(/[+-]/)[0] // Remove timezone part
      const [hours, minutes] = timeOnly.split(':').map(Number)
      const startTimeInHours = hours + minutes / 60
      const duration = session.scheduled_hours || 2 // Use scheduled_hours to match the UI
      const endTimeInHours = startTimeInHours + duration
      
      for (let time = Math.round(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
        const normalizedTime = Math.round(time * 4) / 4
        const key = `${session.scheduled_date}-${normalizedTime}`
        sessionConflicts.set(key, session)
      }
    }
  })
  
  // Pre-compute meeting conflicts (only for dates in current view)
  meetingsData.forEach(meeting => {
    const meetingStart = new Date(meeting.start_time)
    const meetingEnd = new Date(meeting.end_time)
    const dateStr = format(meetingStart, 'yyyy-MM-dd')
    
    // Only process meetings for dates in current view
    if (!validDateStrs.has(dateStr)) return
    
    const startTimeInHours = meetingStart.getHours() + meetingStart.getMinutes() / 60
    const endTimeInHours = meetingEnd.getHours() + meetingEnd.getMinutes() / 60
    
    for (let time = Math.round(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
      const normalizedTime = Math.round(time * 4) / 4
      const key = `${dateStr}-${normalizedTime}`
      meetingConflicts.set(key, meeting)
    }
  })
  
  // Pre-compute task daily logs conflicts (only for dates in current view)
  tasksDailyLogsData.forEach(log => {
    if (log.log_date) {
      // Only process logs for dates in current view
      if (!validDateStrs.has(log.log_date)) return
      
      // Use actual_start_time if available, otherwise fall back to scheduled_start_time
      const startTime = log.actual_start_time || log.scheduled_start_time
      if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number)
        const startTimeInHours = hours + minutes / 60
        // Use actual_duration if available, otherwise fall back to estimated_hours or default to 1
        const duration = log.actual_duration || log.scheduled_duration || log.estimated_hours || 1
        const endTimeInHours = startTimeInHours + duration
        
        for (let time = Math.round(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
          const normalizedTime = Math.round(time * 4) / 4
          const key = `${log.log_date}-${normalizedTime}`
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
      for (let time = Math.round(startTimeInHours * 4) / 4; time < endTimeInHours; time += 0.25) {
        const normalizedTime = Math.round(time * 4) / 4
        const key = `${dateStr}-${normalizedTime}`
        bufferConflicts.set(key, buffer)
      }
    }
  })
  
  return { habitConflicts, sessionConflicts, meetingConflicts, tasksDailyLogsConflicts, bufferConflicts }
}