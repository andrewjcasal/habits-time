import { supabase } from '../lib/supabase'
import { findEmptyTimeSlots, prioritizeBufferPlacement, getCurrentWeekBounds } from './bufferCalculations'
import { BufferBlock } from '../types'

/**
 * Calculate category buffer blocks by fetching data directly from database
 */
export const calculateCategoryBufferBlocks = async (
  userId: string,
  baseDate: Date,
  conflictMaps: any,
  getWorkHoursRange: () => { start: number; end: number },
  habits: any[] = [],
  settings: any = null
): Promise<BufferBlock[]> => {
  
  try {
    const { weekStart, weekEnd } = getCurrentWeekBounds(baseDate)
    console.log('🔍 BUFFER CALCULATION START', { weekStart, weekEnd })
    
    // Fetch category buffers with utilization data
    const { data: buffers, error: buffersError } = await supabase
      .from('category_buffers')
      .select(`
        *,
        meeting_categories(id, name, color)
      `)
      .eq('user_id', userId)
    
    if (buffersError) {
      console.error('Error fetching buffers:', buffersError)
      return []
    }
    
    if (!buffers || buffers.length === 0) {
      console.log('📊 No buffers found')
      return []
    }
    console.log('📊 Found buffers:', buffers.map(b => ({ name: b.meeting_categories?.name, weekly_hours: b.weekly_hours })))
    
    
    // Calculate utilization by querying actual meetings this week
    const { data: weeklyMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('category_id, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', weekStart.toISOString())
      .lt('start_time', weekEnd.toISOString())
      .not('category_id', 'is', null)
    
    if (meetingsError) {
      console.error('Error fetching weekly meetings:', meetingsError)
    }
    
    
    // Calculate actual utilization from real meeting data
    const buffersWithUtilization = buffers.map(buffer => {
      const categoryMeetings = weeklyMeetings?.filter(m => m.category_id === buffer.category_id) || []
      
      console.log(`📝 Processing buffer: ${buffer.meeting_categories?.name}`);
      console.log('  - Category meetings this week:', categoryMeetings.length);
      categoryMeetings.forEach((m, i) => {
        console.log(`    ${i + 1}. ${new Date(m.start_time)} - ${new Date(m.end_time)}`);
      });
      
      // Calculate total hours spent from actual meetings this week
      const hoursSpent = categoryMeetings.reduce((total, meeting) => {
        const start = new Date(meeting.start_time)
        const end = new Date(meeting.end_time)
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        console.log(`    Meeting duration: ${durationHours} hours`);
        return total + durationHours
      }, 0)
      
      const weeklyHours = parseFloat(buffer.weekly_hours.toString())
      const hoursRemaining = Math.max(0, weeklyHours - hoursSpent)
      const utilizationPercentage = weeklyHours > 0 ? (hoursSpent / weeklyHours) * 100 : 0
      
      console.log(`  - Weekly allocation: ${weeklyHours} hours`);
      console.log(`  - Hours spent: ${hoursSpent} hours`);
      console.log(`  - Hours remaining: ${hoursRemaining} hours`);
      
      const utilization = {
        buffer_id: buffer.id,
        category_id: buffer.category_id,
        category_name: buffer.meeting_categories?.name || 'Unknown',
        category_color: buffer.meeting_categories?.color || '#6b7280',
        weekly_hours: weeklyHours,
        hours_spent: hoursSpent,
        hours_remaining: hoursRemaining,
        utilization_percentage: utilizationPercentage
      }
      
      return {
        ...buffer,
        utilization
      }
    })
    
    
    // Use passed settings instead of fetching

    // Get empty slots but filter out times before Morning Routine
    const allEmptySlots = findEmptyTimeSlots(weekStart, weekEnd, conflictMaps, getWorkHoursRange, settings || undefined, habits)
    
    // Filter out slots before Morning Routine and after Wind down time on each day
    const morningRoutineHabit = habits.find(habit => habit.name === 'Morning Routine')
    const windDownHabit = habits.find(habit => habit.name === 'Wind down time')
    
    const emptySlots = allEmptySlots.filter(slot => {
      // Filter out slots before Morning Routine ends
      if (morningRoutineHabit && morningRoutineHabit.habits_daily_logs) {
        const dailyLog = morningRoutineHabit.habits_daily_logs.find(log => log.log_date === slot.dateStr)
        const effectiveStartTime = dailyLog?.scheduled_start_time || morningRoutineHabit.current_start_time
        if (effectiveStartTime) {
          const [morningHour, morningMinute] = effectiveStartTime.split(':').map(Number)
          const morningStartTimeInHours = morningHour + morningMinute / 60
          
          // Calculate when Morning Routine ends (start time + duration)
          const morningRoutineDuration = morningRoutineHabit.duration_hours || 2 // Default to 2 hours if not specified
          const morningEndTimeInHours = morningStartTimeInHours + morningRoutineDuration
          
          // Only include slots that are at or after Morning Routine ends
          if (slot.timeInHours < morningEndTimeInHours) {
            return false
          }
        }
      }
      
      // Filter out slots at or after Wind down time (except Sunday which uses week ending time)
      const dayOfWeek = slot.date.getDay()
      const isSunday = dayOfWeek === 0
      
      if (windDownHabit && !isSunday) {
        // Use Wind down time for all days except Sunday
        const dailyLog = windDownHabit.habits_daily_logs?.find(log => log.log_date === slot.dateStr)
        const windDownStartTime = dailyLog?.scheduled_start_time || windDownHabit.current_start_time
        
        if (windDownStartTime) {
          const [windDownHour, windDownMinute] = windDownStartTime.split(':').map(Number)
          const windDownTimeInHours = windDownHour + windDownMinute / 60
          
          // Exclude slots at or after Wind down time
          if (slot.timeInHours >= windDownTimeInHours) {
            return false
          }
        }
      } else if (isSunday && settings?.week_ending_time) {
        // Use fixed week ending time for Sunday (8:30pm)
        const [endHour, endMinute] = settings.week_ending_time.split(':').map(Number)
        const weekEndTimeInHours = endHour + endMinute / 60
        
        // Exclude slots at or after week ending time
        if (slot.timeInHours >= weekEndTimeInHours) {
          return false
        }
      }
      
      return true
    })
    
    
    const calculatedBufferBlocks = prioritizeBufferPlacement(buffersWithUtilization, emptySlots, settings || undefined, habits)
    
    console.log('🎯 Final buffer blocks:', calculatedBufferBlocks.map(b => ({
      category: b.category_name,
      duration: b.duration,
      remaining_hours: b.remaining_hours,
      date: b.dateStr
    })));
    
    return calculatedBufferBlocks
  } catch (error) {
    console.error('Error in buffer calculation:', error)
    return []
  }
}