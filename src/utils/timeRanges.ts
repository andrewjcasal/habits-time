import { startOfWeek, endOfWeek, subWeeks, subDays, format } from 'date-fns'

export interface TimeRange {
  start: Date
  end: Date
}

/**
 * Get the current week's date range (Monday to Sunday)
 */
export const getThisWeekRange = (): TimeRange => {
  const now = new Date()
  const start = startOfWeek(now, { weekStartsOn: 1 }) // Monday = 1
  const end = endOfWeek(now, { weekStartsOn: 1 })
  
  return { start, end }
}

/**
 * Get the previous week's date range (Monday to Sunday)
 */
export const getLastWeekRange = (): TimeRange => {
  const now = new Date()
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  
  return { start: lastWeekStart, end: lastWeekEnd }
}

/**
 * Get the last 7 days range (rolling 7 days from today)
 */
export const getLast7DaysRange = (): TimeRange => {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999) // End of today
  
  const start = subDays(now, 6) // 6 days ago + today = 7 days
  start.setHours(0, 0, 0, 0) // Start of that day
  
  return { start, end }
}

/**
 * Get time range by period type
 */
export const getTimeRangeByPeriod = (period: 'thisWeek' | 'lastWeek' | 'last7Days'): TimeRange => {
  switch (period) {
    case 'thisWeek':
      return getThisWeekRange()
    case 'lastWeek':
      return getLastWeekRange()
    case 'last7Days':
      return getLast7DaysRange()
    default:
      throw new Error(`Unknown period: ${period}`)
  }
}

/**
 * Check if a date falls within a time range
 */
export const isDateInRange = (date: Date, range: TimeRange): boolean => {
  const dateTime = date.getTime()
  return dateTime >= range.start.getTime() && dateTime <= range.end.getTime()
}

/**
 * Format a time range for display
 */
export const formatTimeRange = (range: TimeRange): string => {
  return `${format(range.start, 'MMM d')} - ${format(range.end, 'MMM d, yyyy')}`
}