import { format } from 'date-fns'
import {
  BufferBlock,
  BufferConfig,
  CategoryActivity,
  TimeSlot,
  WeekBoundary,
  calculateAndPlaceBuffers,
  extractCategorizedActivities
} from './bufferCalculation'

/**
 * Integration helper to convert buffer blocks to the format expected by the calendar
 */
export const convertBufferBlocksToCalendarFormat = (
  bufferBlocks: BufferBlock[],
  categories: Map<string, { id: string; name: string; color?: string }>
): Array<{
  id: string
  title: string
  startTime: string
  endTime: string
  duration: number // in minutes
  date: Date
  dateStr: string
  isBuffer: true
  isReduced: boolean
  isActive: boolean
  topPosition: number
  category_name?: string
  remaining_hours?: number
}> => {
  return bufferBlocks.map(block => {
    const category = categories.get(block.category_id)
    const durationInMinutes = Math.round(block.duration * 60)
    const startHour = Math.floor(block.startTime)
    const startMinute = Math.round((block.startTime % 1) * 60)
    const endTimeInHours = block.startTime + block.duration
    const endHour = Math.floor(endTimeInHours)
    const endMinute = Math.round((endTimeInHours % 1) * 60)

    return {
      id: block.id,
      title: `${category?.name || 'Buffer'} Time`,
      startTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
      duration: durationInMinutes,
      date: block.date,
      dateStr: block.dateStr,
      isBuffer: true as const,
      isReduced: false, // Can be computed based on activity levels
      isActive: true,
      topPosition: block.topPosition,
      category_name: category?.name,
      remaining_hours: block.remaining_hours
    }
  })
}

/**
 * Get buffers for a specific time slot (used by calendar rendering)
 */
export const getBuffersForTimeSlot = (
  timeSlot: string,
  date: Date,
  bufferBlocks: BufferBlock[],
  categories: Map<string, { id: string; name: string; color?: string }>
): Array<{
  id: string
  title: string
  duration: number
  topPosition: number
  isReduced: boolean
  category_name?: string
  remaining_hours?: number
}> => {
  const dateStr = format(date, 'yyyy-MM-dd')
  const currentHour = parseInt(timeSlot.split(':')[0])

  const matchingBuffers = bufferBlocks.filter(block => {
    if (block.dateStr !== dateStr) return false
    
    const bufferStartHour = Math.floor(block.startTime)
    const bufferEndHour = Math.floor(block.startTime + block.duration)
    
    // Hide anything before 6 AM (consistent with other calendar items)
    if (bufferStartHour < 6) return false
    
    // Check if buffer starts within this hour slot or spans across it
    return bufferStartHour === currentHour || (bufferStartHour < currentHour && bufferEndHour > currentHour)
  })

  return matchingBuffers.map(block => {
    const category = categories.get(block.category_id)
    const durationInMinutes = Math.round(block.duration * 60)
    
    // Calculate position within the hour slot
    let topPosition = block.topPosition
    const bufferStartHour = Math.floor(block.startTime)
    
    // If buffer starts in a previous hour but spans into this hour, position at top
    if (bufferStartHour < currentHour) {
      topPosition = 0
    }

    return {
      id: block.id,
      title: `${category?.name || 'Buffer'} Time`,
      duration: durationInMinutes,
      topPosition,
      isReduced: (block.remaining_hours || 0) < (block.duration * 2), // Consider reduced if less than double the current allocation
      category_name: category?.name,
      remaining_hours: block.remaining_hours
    }
  })
}

/**
 * Create buffer conflict map for integration with existing conflict system
 */
export const createBufferConflictMap = (
  bufferBlocks: BufferBlock[]
): Map<string, BufferBlock> => {
  const bufferConflicts = new Map<string, BufferBlock>()

  bufferBlocks.forEach(block => {
    const blockEndTime = block.startTime + block.duration
    
    // Mark all 15-minute slots within this buffer block as conflicted
    for (let time = block.startTime; time < blockEndTime; time += 0.25) {
      const normalizedTime = Math.round(time * 4) / 4
      const conflictKey = `${block.dateStr}-${normalizedTime}`
      bufferConflicts.set(conflictKey, block)
    }
  })

  return bufferConflicts
}

/**
 * Main integration function for the calendar system
 */
export const generateBuffersForCalendar = (
  dayColumns: Array<{ date: Date; dateStr: string }>,
  bufferConfigs: BufferConfig[],
  meetings: any[],
  taskLogs: any[],
  sessions: any[],
  habits: any[],
  conflictMaps: {
    habitConflicts: Map<string, any>
    sessionConflicts: Map<string, any>
    meetingConflicts: Map<string, any>
    tasksDailyLogsConflicts: Map<string, any>
    bufferConflicts: Map<string, any>
  },
  workHoursRange: { start: number; end: number },
  weekBoundary: WeekBoundary,
  categories: Map<string, { id: string; name: string; color?: string }> = new Map()
): {
  bufferBlocks: BufferBlock[]
  calendarBuffers: ReturnType<typeof convertBufferBlocksToCalendarFormat>
  bufferConflictMap: Map<string, BufferBlock>
} => {
  // Extract categorized activities from all sources
  const weekStart = dayColumns[0]?.date || new Date()
  const weekEnd = dayColumns[dayColumns.length - 1]?.date || new Date()
  
  const categorizedActivities = extractCategorizedActivities(
    meetings,
    taskLogs,
    sessions,
    habits,
    weekStart,
    weekEnd
  )

  // Calculate and place buffer blocks
  const bufferBlocks = calculateAndPlaceBuffers(
    dayColumns,
    bufferConfigs,
    categorizedActivities,
    conflictMaps,
    workHoursRange,
    weekBoundary
  )

  // Convert to calendar format
  const calendarBuffers = convertBufferBlocksToCalendarFormat(bufferBlocks, categories)

  // Create conflict map for task scheduling integration
  const bufferConflictMap = createBufferConflictMap(bufferBlocks)

  return {
    bufferBlocks,
    calendarBuffers,
    bufferConflictMap
  }
}

/**
 * Update buffer calculations when activities change
 */
export const updateBuffersAfterActivityChange = (
  activity: {
    category_id: string
    duration: number // in hours
    date: Date
    type: 'meeting' | 'task_log' | 'manual_entry' | 'session' | 'habit'
  },
  currentBufferBlocks: BufferBlock[],
  bufferConfigs: BufferConfig[]
): BufferBlock[] => {
  // Find buffers for the same category
  const affectedBuffers = currentBufferBlocks.filter(
    block => block.category_id === activity.category_id &&
    format(block.date, 'yyyy-MM-dd') === format(activity.date, 'yyyy-MM-dd')
  )

  // Calculate how much to reduce from buffers
  let remainingReduction = activity.duration

  const updatedBlocks = currentBufferBlocks.map(block => {
    if (block.category_id !== activity.category_id || remainingReduction <= 0) {
      return block
    }

    // Check if this block is on the same day or later in the week
    if (block.date >= activity.date) {
      const reductionForThisBlock = Math.min(remainingReduction, block.duration)
      remainingReduction -= reductionForThisBlock

      if (reductionForThisBlock >= block.duration) {
        // Remove this buffer block entirely
        return null
      } else {
        // Reduce the buffer block duration
        return {
          ...block,
          duration: block.duration - reductionForThisBlock,
          remaining_hours: (block.remaining_hours || 0) - reductionForThisBlock
        }
      }
    }

    return block
  }).filter((block): block is BufferBlock => block !== null)

  return updatedBlocks
}

/**
 * Validate buffer configuration
 */
export const validateBufferConfig = (config: Partial<BufferConfig>): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []

  if (!config.category_id) {
    errors.push('Category is required')
  }

  if (!config.weekly_hours || config.weekly_hours <= 0) {
    errors.push('Weekly hours must be greater than 0')
  }

  if (config.weekly_hours && config.weekly_hours > 168) {
    errors.push('Weekly hours cannot exceed 168 hours (24 hours × 7 days)')
  }

  if (config.priority && (config.priority < 0 || config.priority > 10)) {
    errors.push('Priority must be between 0 and 10')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get buffer statistics for reporting
 */
export interface BufferStats {
  category_id: string
  category_name?: string
  weekly_hours_allocated: number
  hours_spent: number
  hours_remaining: number
  utilization_percentage: number
  buffer_blocks_count: number
  days_with_buffers: number
}

export const getBufferStatistics = (
  bufferConfigs: BufferConfig[],
  categorizedActivities: CategoryActivity[],
  bufferBlocks: BufferBlock[],
  categories: Map<string, { id: string; name: string; color?: string }>,
  weekStartDate: Date,
  weekEndDate: Date
): BufferStats[] => {
  return bufferConfigs.map(config => {
    // Calculate spent hours
    const weekActivities = categorizedActivities.filter(activity => 
      activity.category_id === config.category_id &&
      activity.date >= weekStartDate &&
      activity.date <= weekEndDate
    )
    const hoursSpent = weekActivities.reduce((sum, activity) => sum + activity.duration, 0)
    
    // Calculate remaining hours
    const hoursRemaining = Math.max(0, config.weekly_hours - hoursSpent)
    
    // Calculate utilization
    const utilizationPercentage = config.weekly_hours > 0 
      ? Math.round((hoursSpent / config.weekly_hours) * 100)
      : 0

    // Count buffer blocks
    const categoryBufferBlocks = bufferBlocks.filter(block => block.category_id === config.category_id)
    const daysWithBuffers = new Set(categoryBufferBlocks.map(block => block.dateStr)).size

    const category = categories.get(config.category_id)

    return {
      category_id: config.category_id,
      category_name: category?.name,
      weekly_hours_allocated: config.weekly_hours,
      hours_spent: hoursSpent,
      hours_remaining: hoursRemaining,
      utilization_percentage: utilizationPercentage,
      buffer_blocks_count: categoryBufferBlocks.length,
      days_with_buffers: daysWithBuffers
    }
  })
}

/**
 * Helper to create week boundary from settings
 */
export const createWeekBoundaryFromSettings = (settings: {
  week_ending_day?: string
  week_ending_time?: string
  week_ending_timezone?: string
}): WeekBoundary => ({
  weekEndingDay: settings.week_ending_day || 'sunday',
  weekEndingTime: settings.week_ending_time || '20:30',
  weekEndingTimezone: settings.week_ending_timezone || 'America/New_York'
})