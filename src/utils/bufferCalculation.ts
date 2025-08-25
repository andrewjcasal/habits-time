import { format, addDays, parseISO, isAfter, isBefore, isEqual, isSameDay } from 'date-fns'

// Types for buffer system
export interface BufferConfig {
  id: string
  user_id: string
  category_id: string
  weekly_hours: number
  priority?: number // Higher numbers = higher priority
  created_at?: string
  updated_at?: string
}

export interface CategoryActivity {
  id: string
  category_id: string
  duration: number // in hours
  date: Date
  type: 'meeting' | 'task_log' | 'manual_entry' | 'session' | 'habit'
}

export interface TimeSlot {
  date: Date
  dateStr: string
  timeInHours: number
  timeSlot: string // "HH:MM" format
  durationMinutes: number // 15-minute increments
  isEmpty: boolean
  conflicts: string[] // Array of conflict types
}

export interface BufferBlock {
  id: string
  category_id: string
  buffer_config_id: string
  date: Date
  dateStr: string
  startTime: number // in hours (e.g., 14.5 for 2:30 PM)
  duration: number // in hours
  timeSlot: string // "HH:MM" format for display
  endTime: number // in hours
  topPosition: number // for calendar positioning
  isBuffer: true
  priority: number
  category_name?: string
  remaining_hours?: number
}

export interface WeekBoundary {
  weekEndingDay: string // 'sunday', 'monday', etc.
  weekEndingTime: string // "20:30"
  weekEndingTimezone: string // "America/New_York"
}

/**
 * Find all empty time slots in a given week that can accommodate buffers
 */
export const findEmptyTimeSlots = (
  dayColumns: Array<{ date: Date; dateStr: string }>,
  conflictMaps: {
    habitConflicts: Map<string, any>
    sessionConflicts: Map<string, any>
    meetingConflicts: Map<string, any>
    tasksDailyLogsConflicts: Map<string, any>
    bufferConflicts: Map<string, any>
  },
  workHoursRange: { start: number; end: number },
  weekBoundary: WeekBoundary
): TimeSlot[] => {
  const emptySlots: TimeSlot[] = []
  const currentTime = new Date()

  dayColumns.forEach(({ date, dateStr }) => {
    const isToday = format(currentTime, 'yyyy-MM-dd') === dateStr
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))
    
    // Skip past dates completely
    if (isPast) return

    // Check if this date exceeds the week ending boundary
    if (isAfterWeekEnding(date, weekBoundary)) return

    // Calculate effective start time for today (current time + buffer)
    let effectiveStartTime = workHoursRange.start
    if (isToday) {
      const currentHour = currentTime.getHours()
      const currentMinute = currentTime.getMinutes()
      const currentTimeInHours = currentHour + currentMinute / 60
      // Add 15-minute buffer and round up to next quarter hour
      const nextQuarterHour = Math.ceil((currentTimeInHours + 0.25) * 4) / 4
      effectiveStartTime = Math.max(workHoursRange.start, nextQuarterHour)
    }

    // Calculate end time based on week ending day/time for this specific date
    const effectiveEndTime = getEffectiveEndTimeForDate(date, weekBoundary, workHoursRange.end)

    // Generate 15-minute time slots
    for (let hour = Math.floor(effectiveStartTime); hour < effectiveEndTime; hour++) {
      for (let quarter = 0; quarter < 4; quarter++) {
        const timeInHours = hour + (quarter * 15) / 60
        
        // Skip slots before effective start time
        if (timeInHours < effectiveStartTime) continue
        
        const minutes = quarter * 15
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        
        // Check for conflicts using the same logic as task scheduling
        const normalizedTime = Math.round(timeInHours * 4) / 4
        const conflictKey = `${dateStr}-${normalizedTime}`
        
        const hasHabitConflict = conflictMaps.habitConflicts.has(conflictKey)
        const hasSessionConflict = conflictMaps.sessionConflicts.has(conflictKey)
        const hasMeetingConflict = conflictMaps.meetingConflicts.has(conflictKey)
        const hasTaskLogConflict = conflictMaps.tasksDailyLogsConflicts?.has(conflictKey)
        
        const conflicts = []
        if (hasHabitConflict) conflicts.push('habit')
        if (hasSessionConflict) conflicts.push('session')
        if (hasMeetingConflict) conflicts.push('meeting')
        if (hasTaskLogConflict) conflicts.push('tasklog')
        
        const isEmpty = conflicts.length === 0

        emptySlots.push({
          date,
          dateStr,
          timeInHours,
          timeSlot,
          durationMinutes: 15,
          isEmpty,
          conflicts
        })
      }
    }
  })

  return emptySlots
}

/**
 * Calculate remaining buffer hours for each category based on actual activities
 */
export const calculateRemainingBufferHours = (
  bufferConfigs: BufferConfig[],
  categorizedActivities: CategoryActivity[],
  weekStartDate: Date,
  weekEndDate: Date
): Map<string, { config: BufferConfig; remaining: number; spent: number }> => {
  const remainingHours = new Map<string, { config: BufferConfig; remaining: number; spent: number }>()

  bufferConfigs.forEach(config => {
    // Filter activities for this category within the week
    const weekActivities = categorizedActivities.filter(activity => 
      activity.category_id === config.category_id &&
      activity.date >= weekStartDate &&
      activity.date <= weekEndDate
    )

    // Calculate total hours spent in this category
    const totalSpent = weekActivities.reduce((sum, activity) => sum + activity.duration, 0)
    const remaining = Math.max(0, config.weekly_hours - totalSpent)

    remainingHours.set(config.category_id, {
      config,
      remaining,
      spent: totalSpent
    })
  })

  return remainingHours
}

/**
 * Allocate buffer blocks to available time slots with priority handling
 */
export const allocateBufferBlocks = (
  emptyTimeSlots: TimeSlot[],
  remainingBufferHours: Map<string, { config: BufferConfig; remaining: number; spent: number }>,
  existingBufferBlocks: BufferBlock[] = []
): BufferBlock[] => {
  const allocatedBlocks: BufferBlock[] = []
  const availableSlots = emptyTimeSlots.filter(slot => slot.isEmpty)
  
  // Sort buffer configs by priority (higher priority first)
  const sortedBufferConfigs = Array.from(remainingBufferHours.entries())
    .filter(([_, data]) => data.remaining > 0) // Only allocate for categories with remaining hours
    .sort(([_a, dataA], [_b, dataB]) => (dataB.config.priority || 0) - (dataA.config.priority || 0))

  // Group slots by date for better distribution
  const slotsByDate = new Map<string, TimeSlot[]>()
  availableSlots.forEach(slot => {
    if (!slotsByDate.has(slot.dateStr)) {
      slotsByDate.set(slot.dateStr, [])
    }
    slotsByDate.get(slot.dateStr)!.push(slot)
  })

  // Track slot usage to prevent conflicts
  const usedSlots = new Set<string>()
  
  // Add existing buffer blocks to used slots to prevent conflicts
  existingBufferBlocks.forEach(block => {
    const blockEndTime = block.startTime + block.duration
    // Mark all 15-minute slots within this buffer block as used
    for (let time = block.startTime; time < blockEndTime; time += 0.25) {
      const slotKey = `${block.dateStr}-${Math.round(time * 4) / 4}`
      usedSlots.add(slotKey)
    }
  })

  sortedBufferConfigs.forEach(([categoryId, data]) => {
    let remainingHoursToAllocate = data.remaining
    const bufferConfig = data.config

    // Distribute buffer hours across available dates
    const availableDates = Array.from(slotsByDate.keys()).sort()
    
    availableDates.forEach(dateStr => {
      if (remainingHoursToAllocate <= 0) return

      const dateSlots = slotsByDate.get(dateStr)!
        .filter(slot => !usedSlots.has(`${slot.dateStr}-${slot.timeInHours}`))
        .sort((a, b) => a.timeInHours - b.timeInHours) // Earlier slots first

      if (dateSlots.length === 0) return

      // Calculate how much to allocate for this date (distribute evenly)
      const remainingDates = availableDates.filter(d => d >= dateStr).length
      const hoursForThisDate = Math.min(
        remainingHoursToAllocate / remainingDates,
        dateSlots.length * 0.25 // Don't exceed available slots
      )

      if (hoursForThisDate < 0.25) return // Must be at least 15 minutes

      // Find contiguous blocks of time for better user experience
      const contiguousBlocks = findContiguousTimeBlocks(dateSlots, usedSlots, dateStr)
      
      contiguousBlocks.forEach(block => {
        if (remainingHoursToAllocate <= 0) return

        const blockDuration = Math.min(
          block.duration,
          remainingHoursToAllocate,
          hoursForThisDate - (allocatedBlocks
            .filter(ab => ab.dateStr === dateStr && ab.category_id === categoryId)
            .reduce((sum, ab) => sum + ab.duration, 0))
        )

        if (blockDuration < 0.25) return

        const bufferBlock: BufferBlock = {
          id: `buffer-${bufferConfig.id}-${dateStr}-${block.startTime}`,
          category_id: categoryId,
          buffer_config_id: bufferConfig.id,
          date: block.date,
          dateStr,
          startTime: block.startTime,
          duration: blockDuration,
          timeSlot: `${Math.floor(block.startTime).toString().padStart(2, '0')}:${Math.round((block.startTime % 1) * 60).toString().padStart(2, '0')}`,
          endTime: block.startTime + blockDuration,
          topPosition: ((block.startTime % 1) * 60 / 60) * 100,
          isBuffer: true,
          priority: bufferConfig.priority || 0,
          remaining_hours: data.remaining
        }

        allocatedBlocks.push(bufferBlock)
        remainingHoursToAllocate -= blockDuration

        // Mark used slots
        for (let time = block.startTime; time < block.startTime + blockDuration; time += 0.25) {
          const slotKey = `${dateStr}-${Math.round(time * 4) / 4}`
          usedSlots.add(slotKey)
        }
      })
    })
  })

  return allocatedBlocks
}

/**
 * Find contiguous blocks of available time for better buffer placement
 */
const findContiguousTimeBlocks = (
  slots: TimeSlot[],
  usedSlots: Set<string>,
  dateStr: string
): Array<{ startTime: number; duration: number; date: Date }> => {
  const blocks: Array<{ startTime: number; duration: number; date: Date }> = []
  let currentBlockStart: number | null = null
  let currentBlockDuration = 0

  const sortedSlots = slots.sort((a, b) => a.timeInHours - b.timeInHours)

  sortedSlots.forEach((slot, index) => {
    const slotKey = `${dateStr}-${slot.timeInHours}`
    const isSlotUsed = usedSlots.has(slotKey)

    if (!isSlotUsed) {
      if (currentBlockStart === null) {
        currentBlockStart = slot.timeInHours
        currentBlockDuration = 0.25
      } else {
        // Check if this slot is contiguous with the current block
        const expectedTime = currentBlockStart + currentBlockDuration
        if (Math.abs(slot.timeInHours - expectedTime) < 0.01) {
          currentBlockDuration += 0.25
        } else {
          // End current block and start new one
          blocks.push({
            startTime: currentBlockStart,
            duration: currentBlockDuration,
            date: slot.date
          })
          currentBlockStart = slot.timeInHours
          currentBlockDuration = 0.25
        }
      }
    } else {
      // End current block if slot is used
      if (currentBlockStart !== null) {
        blocks.push({
          startTime: currentBlockStart,
          duration: currentBlockDuration,
          date: slot.date
        })
        currentBlockStart = null
        currentBlockDuration = 0
      }
    }

    // Handle end of slots
    if (index === sortedSlots.length - 1 && currentBlockStart !== null) {
      blocks.push({
        startTime: currentBlockStart,
        duration: currentBlockDuration,
        date: slot.date
      })
    }
  })

  return blocks.filter(block => block.duration >= 0.25) // At least 15 minutes
}

/**
 * Handle buffer priority conflicts when multiple buffers compete for the same slots
 */
export const resolveBufferConflicts = (
  bufferBlocks: BufferBlock[]
): BufferBlock[] => {
  // Group blocks by time slot to identify conflicts
  const slotConflicts = new Map<string, BufferBlock[]>()

  bufferBlocks.forEach(block => {
    const blockEndTime = block.startTime + block.duration
    
    // Check each 15-minute increment this block occupies
    for (let time = block.startTime; time < blockEndTime; time += 0.25) {
      const slotKey = `${block.dateStr}-${Math.round(time * 4) / 4}`
      
      if (!slotConflicts.has(slotKey)) {
        slotConflicts.set(slotKey, [])
      }
      slotConflicts.get(slotKey)!.push(block)
    }
  })

  const resolvedBlocks: BufferBlock[] = []
  const processedBlocks = new Set<string>()

  // Process each time slot to resolve conflicts
  slotConflicts.forEach((conflictingBlocks, slotKey) => {
    if (conflictingBlocks.length <= 1) {
      // No conflict, add block if not already processed
      conflictingBlocks.forEach(block => {
        if (!processedBlocks.has(block.id)) {
          resolvedBlocks.push(block)
          processedBlocks.add(block.id)
        }
      })
      return
    }

    // Resolve conflict by priority (higher priority wins)
    const sortedByPriority = conflictingBlocks.sort((a, b) => b.priority - a.priority)
    const winningBlock = sortedByPriority[0]

    if (!processedBlocks.has(winningBlock.id)) {
      resolvedBlocks.push(winningBlock)
      processedBlocks.add(winningBlock.id)
    }

    // Mark losing blocks as processed to prevent duplication
    sortedByPriority.slice(1).forEach(block => {
      processedBlocks.add(block.id)
    })
  })

  return resolvedBlocks
}

/**
 * Check if a date is after the week ending boundary
 */
const isAfterWeekEnding = (date: Date, weekBoundary: WeekBoundary): boolean => {
  const weekEndingDayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(weekBoundary.weekEndingDay.toLowerCase())
  
  const dateStr = format(date, 'yyyy-MM-dd')
  const dayOfWeek = date.getDay() // 0 = Sunday
  const [hours, minutes] = weekBoundary.weekEndingTime.split(':').map(Number)
  const endTimeInHours = hours + minutes / 60

  // If today is the week ending day, check time
  if (dayOfWeek === weekEndingDayIndex) {
    const currentHour = date.getHours()
    const currentMinute = date.getMinutes()
    const currentTimeInHours = currentHour + currentMinute / 60
    return currentTimeInHours >= endTimeInHours
  }

  // Check if date is after the week ending day
  // Handle week wrap-around (e.g., if week ends on Wednesday, Thursday-Saturday are after)
  if (weekEndingDayIndex < dayOfWeek) {
    return true
  }

  return false
}

/**
 * Get effective end time for a specific date based on week ending rules
 */
const getEffectiveEndTimeForDate = (
  date: Date,
  weekBoundary: WeekBoundary,
  defaultEndTime: number
): number => {
  const weekEndingDayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(weekBoundary.weekEndingDay.toLowerCase())
  
  const dayOfWeek = date.getDay()
  const [hours, minutes] = weekBoundary.weekEndingTime.split(':').map(Number)
  const weekEndingTimeInHours = hours + minutes / 60

  // If this is the week ending day, use the week ending time
  if (dayOfWeek === weekEndingDayIndex) {
    return Math.min(defaultEndTime, weekEndingTimeInHours)
  }

  // For other days, use the default work hours end time
  return defaultEndTime
}

/**
 * Main function to calculate and place all buffers for the week
 */
export const calculateAndPlaceBuffers = (
  dayColumns: Array<{ date: Date; dateStr: string }>,
  bufferConfigs: BufferConfig[],
  categorizedActivities: CategoryActivity[],
  conflictMaps: {
    habitConflicts: Map<string, any>
    sessionConflicts: Map<string, any>
    meetingConflicts: Map<string, any>
    tasksDailyLogsConflicts: Map<string, any>
    bufferConflicts: Map<string, any>
  },
  workHoursRange: { start: number; end: number },
  weekBoundary: WeekBoundary,
  existingBufferBlocks: BufferBlock[] = []
): BufferBlock[] => {
  // Step 1: Find all empty time slots
  const emptyTimeSlots = findEmptyTimeSlots(
    dayColumns,
    conflictMaps,
    workHoursRange,
    weekBoundary
  )

  // Step 2: Calculate remaining buffer hours for each category
  const weekStart = dayColumns[0]?.date || new Date()
  const weekEnd = dayColumns[dayColumns.length - 1]?.date || new Date()
  
  const remainingBufferHours = calculateRemainingBufferHours(
    bufferConfigs,
    categorizedActivities,
    weekStart,
    weekEnd
  )

  // Step 3: Allocate buffer blocks to available slots
  const allocatedBlocks = allocateBufferBlocks(
    emptyTimeSlots,
    remainingBufferHours,
    existingBufferBlocks
  )

  // Step 4: Resolve any priority conflicts
  const resolvedBlocks = resolveBufferConflicts(allocatedBlocks)

  return resolvedBlocks
}

/**
 * Convert meetings, tasks, sessions, and habits to categorized activities
 */
export const extractCategorizedActivities = (
  meetings: any[],
  taskLogs: any[],
  sessions: any[],
  habits: any[],
  weekStartDate: Date,
  weekEndDate: Date
): CategoryActivity[] => {
  const activities: CategoryActivity[] = []

  // Extract from meetings
  meetings.forEach(meeting => {
    if (!meeting.category_id) return
    
    const startDate = new Date(meeting.start_time)
    const endDate = new Date(meeting.end_time)
    
    if (startDate >= weekStartDate && startDate <= weekEndDate) {
      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) // hours
      activities.push({
        id: meeting.id,
        category_id: meeting.category_id,
        duration,
        date: startDate,
        type: 'meeting'
      })
    }
  })

  // Extract from task logs
  taskLogs.forEach(log => {
    if (!log.tasks?.category_id) return
    
    const logDate = new Date(log.log_date)
    if (logDate >= weekStartDate && logDate <= weekEndDate) {
      const duration = log.estimated_hours || 0
      activities.push({
        id: log.id,
        category_id: log.tasks.category_id,
        duration,
        date: logDate,
        type: 'task_log'
      })
    }
  })

  // Extract from sessions
  sessions.forEach(session => {
    if (!session.projects?.category_id || !session.actual_start_time) return
    
    const sessionDate = new Date(session.scheduled_date)
    if (sessionDate >= weekStartDate && sessionDate <= weekEndDate) {
      const duration = session.scheduled_hours || 0
      activities.push({
        id: session.id,
        category_id: session.projects.category_id,
        duration,
        date: sessionDate,
        type: 'session'
      })
    }
  })

  // Extract from habits
  habits.forEach(habit => {
    if (!habit.category_id) return
    
    // Check habit logs within the week
    habit.habits_daily_logs?.forEach((log: any) => {
      const logDate = new Date(log.log_date)
      if (logDate >= weekStartDate && logDate <= weekEndDate && !log.is_skipped) {
        const duration = (log.duration || habit.duration || 0) / 60 // Convert minutes to hours
        activities.push({
          id: log.id || `${habit.id}-${log.log_date}`,
          category_id: habit.category_id,
          duration,
          date: logDate,
          type: 'habit'
        })
      }
    })
  })

  return activities
}