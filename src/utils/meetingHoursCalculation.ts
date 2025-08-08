import { Meeting } from '../types'
import { TimeRange, isDateInRange } from './timeRanges'

export interface CategoryMeetingData {
  id: string | null // null for uncategorized
  name: string
  color: string
  totalHours: number
  totalMinutes: number
  meetings: Meeting[]
}

export interface MeetingCategory {
  id: string
  name: string
  color: string
}

/**
 * Calculate the duration of a meeting in minutes
 */
export const calculateMeetingDuration = (meeting: Meeting): number => {
  const startTime = new Date(meeting.start_time)
  const endTime = new Date(meeting.end_time)
  return Math.max(0, (endTime.getTime() - startTime.getTime()) / (1000 * 60))
}

/**
 * Filter meetings by time range
 */
export const filterMeetingsByTimeRange = (meetings: Meeting[], timeRange: TimeRange): Meeting[] => {
  return meetings.filter(meeting => {
    const meetingDate = new Date(meeting.start_time)
    return isDateInRange(meetingDate, timeRange)
  })
}

/**
 * Group meetings by category and calculate total hours
 */
export const calculateMeetingHoursByCategory = (
  meetings: Meeting[], 
  categories: MeetingCategory[],
  timeRange: TimeRange
): CategoryMeetingData[] => {
  // Filter meetings by time range first
  const filteredMeetings = filterMeetingsByTimeRange(meetings, timeRange)
  
  // Create a map to group meetings by category
  const categoryMap = new Map<string | null, Meeting[]>()
  
  // Group meetings by category_id
  filteredMeetings.forEach(meeting => {
    const categoryId = meeting.category_id || null
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, [])
    }
    categoryMap.get(categoryId)!.push(meeting)
  })
  
  // Convert to CategoryMeetingData array
  const result: CategoryMeetingData[] = []
  
  categoryMap.forEach((meetings, categoryId) => {
    const totalMinutes = meetings.reduce((sum, meeting) => {
      return sum + calculateMeetingDuration(meeting)
    }, 0)
    
    const totalHours = totalMinutes / 60
    
    if (categoryId === null) {
      // Uncategorized meetings
      result.push({
        id: null,
        name: 'Uncategorized',
        color: '#9ca3af', // neutral-400
        totalHours,
        totalMinutes,
        meetings
      })
    } else {
      // Find the category details
      const category = categories.find(cat => cat.id === categoryId)
      if (category) {
        result.push({
          id: categoryId,
          name: category.name,
          color: category.color,
          totalHours,
          totalMinutes,
          meetings
        })
      }
    }
  })
  
  // Sort by total hours (descending) then by name
  return result.sort((a, b) => {
    if (b.totalHours !== a.totalHours) {
      return b.totalHours - a.totalHours
    }
    return a.name.localeCompare(b.name)
  })
}

/**
 * Format hours for display
 */
export const formatHours = (hours: number): string => {
  if (hours === 0) return '0h'
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}m`
  }
  
  const wholeHours = Math.floor(hours)
  const remainingMinutes = Math.round((hours - wholeHours) * 60)
  
  if (remainingMinutes === 0) {
    return `${wholeHours}h`
  }
  
  return `${wholeHours}h ${remainingMinutes}m`
}

/**
 * Get total hours across all categories
 */
export const getTotalHoursAcrossCategories = (categoryData: CategoryMeetingData[]): number => {
  return categoryData.reduce((sum, category) => sum + category.totalHours, 0)
}