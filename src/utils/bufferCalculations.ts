import { format, addDays, startOfWeek, endOfWeek, isAfter, isBefore } from 'date-fns'
import { BufferBlock, BufferUtilization, CategoryBuffer } from '../types'

/**
 * Find empty time slots in the calendar that can be filled with buffers
 */
export const findEmptyTimeSlots = (
  startDate: Date,
  endDate: Date,
  conflictMaps: any,
  getWorkHoursRange: () => { start: number; end: number },
  weekSettings?: { week_ending_day: string; week_ending_time: string }
) => {
  const emptySlots: Array<{ timeInHours: number; date: Date; dateStr: string }> = []
  const { start: workStart, end: workEnd } = getWorkHoursRange()
  
  let currentDate = new Date(startDate)
  
  while (isBefore(currentDate, endDate) || currentDate.toDateString() === endDate.toDateString()) {
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    
    // Don't skip weekends for buffer calculation
    // (buffers can be scheduled on weekends)
    
    // Check each 15-minute slot throughout the work day
    // Adjust end time for week ending day
    const dayOfWeek = currentDate.getDay()
    let effectiveWorkEnd = workEnd
    
    if (weekSettings?.week_ending_day && weekSettings?.week_ending_time) {
      const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
      const weekEndingDayNum = dayMap[weekSettings.week_ending_day.toLowerCase() as keyof typeof dayMap]
      
      if (dayOfWeek === weekEndingDayNum) {
        const [endHour, endMinute] = weekSettings.week_ending_time.split(':').map(Number)
        effectiveWorkEnd = endHour + endMinute / 60
      }
    }
    
    for (let hour = workStart; hour < effectiveWorkEnd; hour++) {
      for (let quarterHour = 0; quarterHour < 4; quarterHour++) {
        const minutes = quarterHour * 15
        const timeInHours = hour + minutes / 60
        
        
        // Check if this time slot has any conflicts
        const normalizedTime = Math.round(timeInHours * 4) / 4
        const conflictKey = `${dateStr}-${normalizedTime}`
        
        const habitConflict = conflictMaps.habitConflicts?.get(conflictKey)
        const sessionConflict = conflictMaps.sessionConflicts?.get(conflictKey)
        const meetingConflict = conflictMaps.meetingConflicts?.get(conflictKey)
        const tasksDailyLogsConflict = conflictMaps.tasksDailyLogsConflicts?.get(conflictKey)
        const bufferConflict = conflictMaps.bufferConflicts?.get(conflictKey)
        
        // If no conflicts, this slot is available for buffers
        if (!habitConflict && !sessionConflict && !meetingConflict && 
            !tasksDailyLogsConflict && !bufferConflict) {
          emptySlots.push({
            timeInHours,
            date: new Date(currentDate),
            dateStr
          })
        }
      }
    }
    
    currentDate = addDays(currentDate, 1)
  }
  
  return emptySlots
}

/**
 * Calculate buffer utilization based on meetings in categories
 */
export const calculateBufferUtilization = (
  categoryId: string,
  weekStart: Date,
  meetings: Array<{ category_id: string; start_time: string; end_time: string }>
) => {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  
  const categoryMeetings = meetings.filter(meeting => 
    meeting.category_id === categoryId &&
    isAfter(new Date(meeting.start_time), weekStart) &&
    isBefore(new Date(meeting.start_time), weekEnd)
  )
  
  const totalHours = categoryMeetings.reduce((sum, meeting) => {
    const start = new Date(meeting.start_time)
    const end = new Date(meeting.end_time)
    const durationMs = end.getTime() - start.getTime()
    const durationHours = durationMs / (1000 * 60 * 60)
    return sum + durationHours
  }, 0)
  
  return totalHours
}

/**
 * Allocate buffer hours to available time slots
 */
export const allocateBufferBlocks = (
  bufferHours: number,
  emptySlots: Array<{ timeInHours: number; date: Date; dateStr: string }>,
  categoryInfo: { id: string; name: string; color: string },
  bufferId: string,
  weekSettings?: { week_ending_day: string; week_ending_time: string }
): BufferBlock[] => {
  if (bufferHours <= 0 || emptySlots.length === 0) {
    return []
  }
  
  const blocks: BufferBlock[] = []
  const slotsPerHour = 4 // 15-minute slots per hour
  const slotDuration = 0.25 // Each slot is 15 minutes = 0.25 hours
  
  // Calculate how many slots we need
  const totalSlotsNeeded = Math.ceil(bufferHours / slotDuration)
  
  // Group slots by day and find consecutive blocks within each day
  const slotsByDay = new Map<string, Array<{ timeInHours: number; date: Date; dateStr: string }>>()
  
  for (const slot of emptySlots) {
    if (!slotsByDay.has(slot.dateStr)) {
      slotsByDay.set(slot.dateStr, [])
    }
    slotsByDay.get(slot.dateStr)!.push(slot)
  }
  
  // Sort days by date in reverse order (latest date first, working backwards)
  const sortedDays = Array.from(slotsByDay.entries()).sort(([dateA], [dateB]) => {
    return dateB.localeCompare(dateA) // Latest date first
  })
  
  let remainingHours = bufferHours
  
  // Fill from latest day backwards
  for (const [dateStr, daySlots] of sortedDays) {
    if (remainingHours <= 0) break
    
    // Sort slots within the day from latest to earliest
    const sortedDaySlots = daySlots.sort((a, b) => b.timeInHours - a.timeInHours)
    
    // Find consecutive blocks within this day (working backwards)
    let i = 0
    while (i < sortedDaySlots.length && remainingHours > 0) {
      const startSlot = sortedDaySlots[i]
      let blockDuration = slotDuration
      let blockStart = startSlot.timeInHours
      let j = i + 1
      
      // Find consecutive earlier slots to extend the block backwards
      while (j < sortedDaySlots.length && 
             Math.abs(sortedDaySlots[j].timeInHours - (blockStart - slotDuration)) < 0.01 &&
             remainingHours > blockDuration) {
        blockStart = sortedDaySlots[j].timeInHours
        blockDuration += slotDuration
        j++
      }
      
      // Create the buffer block
      let hoursToAllocate = Math.min(remainingHours, blockDuration)
      
      // Check if this block extends past week ending time and cap it
      // Apply week ending time constraint to all days to respect weekly work cutoff
      if (weekSettings?.week_ending_time) {
        const [endHour, endMinute] = weekSettings.week_ending_time.split(':').map(Number)
        const weekEndTimeInHours = endHour + endMinute / 60
        
        console.log(`[BUFFER DEBUG] Checking week end cap - date: ${startSlot.dateStr}, blockStart: ${blockStart}, duration: ${hoursToAllocate}, weekEndTime: ${weekEndTimeInHours}`)
        
        // Cap the block so it doesn't extend past week ending time
        const blockEndTime = blockStart + hoursToAllocate
        if (blockEndTime > weekEndTimeInHours) {
          const originalHours = hoursToAllocate
          hoursToAllocate = weekEndTimeInHours - blockStart
          console.log(`[BUFFER DEBUG] Capping buffer from ${originalHours}h to ${hoursToAllocate}h for week ending constraint`)
        }
      }
      
      if (hoursToAllocate > 0) {
        blocks.push({
          id: `${bufferId}-block-${blocks.length}`,
          buffer_id: bufferId,
          category_id: categoryInfo.id,
          category_name: categoryInfo.name,
          category_color: categoryInfo.color,
          start_time: blockStart,
          duration: hoursToAllocate,
          remaining_hours: bufferHours,
          date: startSlot.date,
          dateStr: startSlot.dateStr
        })
      }
      
      remainingHours -= hoursToAllocate
      i = j
    }
  }
  
  return blocks
}

/**
 * Prioritize buffer placement when multiple buffers compete for slots
 */
export const prioritizeBufferPlacement = (
  buffers: Array<CategoryBuffer & { 
    meeting_categories?: { name: string; color: string }
    utilization: BufferUtilization
  }>,
  emptySlots: Array<{ timeInHours: number; date: Date; dateStr: string }>,
  weekSettings?: { week_ending_day: string; week_ending_time: string }
): BufferBlock[] => {
  // Sort buffers by priority (could be customized)
  // For now, prioritize by:
  // 1. Lowest utilization percentage (more urgent)
  // 2. Higher weekly hours (more important)
  const sortedBuffers = [...buffers].sort((a, b) => {
    if (a.utilization.utilization_percentage !== b.utilization.utilization_percentage) {
      return a.utilization.utilization_percentage - b.utilization.utilization_percentage
    }
    return b.weekly_hours - a.weekly_hours
  })
  
  const allBlocks: BufferBlock[] = []
  const usedSlots = new Set<string>()
  
  for (const buffer of sortedBuffers) {
    // Only allocate remaining hours
    const remainingHours = buffer.utilization.hours_remaining
    if (remainingHours <= 0) continue
    
    // Filter out already used slots
    const availableSlots = emptySlots.filter(slot => {
      const slotKey = `${slot.dateStr}-${slot.timeInHours}`
      return !usedSlots.has(slotKey)
    })
    
    const categoryInfo = {
      id: buffer.category_id,
      name: buffer.meeting_categories?.name || 'Unknown Category',
      color: buffer.meeting_categories?.color || '#6b7280'
    }
    
    const bufferBlocks = allocateBufferBlocks(
      remainingHours,
      availableSlots,
      categoryInfo,
      buffer.id,
      weekSettings
    )
    
    // Mark used slots
    for (const block of bufferBlocks) {
      const slotsPerHour = 4
      const totalSlots = Math.ceil(block.duration * slotsPerHour)
      
      for (let i = 0; i < totalSlots; i++) {
        const slotTime = block.start_time + (i * 0.25)
        const slotKey = `${block.dateStr}-${slotTime}`
        usedSlots.add(slotKey)
      }
    }
    
    allBlocks.push(...bufferBlocks)
  }
  
  return allBlocks
}

/**
 * Get current week bounds for buffer calculations
 */
export const getCurrentWeekBounds = (baseDate: Date = new Date()) => {
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
  
  return { weekStart, weekEnd }
}