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
  console.log('[BUFFER DEBUG] Starting buffer calculation step...')
  
  try {
    const { weekStart, weekEnd } = getCurrentWeekBounds(baseDate)
    
    // Fetch category buffers with utilization data
    const { data: buffers, error: buffersError } = await supabase
      .from('category_buffers')
      .select(`
        *,
        meeting_categories(id, name, color)
      `)
      .eq('user_id', userId)
    
    if (buffersError) {
      console.error('[BUFFER DEBUG] Error fetching buffers:', buffersError)
      return []
    }
    
    if (!buffers || buffers.length === 0) {
      console.log('[BUFFER DEBUG] No category buffers found')
      return []
    }
    
    console.log('[BUFFER DEBUG] Fetched buffers:', buffers)
    
    // Get utilization data
    const { data: utilization, error: utilizationError } = await supabase
      .rpc('get_buffer_utilization', {
        p_user_id: userId,
        p_week_start: weekStart.toISOString(),
        p_week_end: weekEnd.toISOString()
      })
    
    if (utilizationError) {
      console.error('[BUFFER DEBUG] Error fetching utilization:', utilizationError)
    }
    
    console.log('[BUFFER DEBUG] Utilization data:', utilization)
    
    // Combine buffer and utilization data
    const buffersWithUtilization = buffers.map(buffer => {
      const util = utilization?.find(u => u.buffer_id === buffer.id)
      const fallbackUtil = {
        buffer_id: buffer.id,
        category_id: buffer.category_id,
        category_name: buffer.meeting_categories?.name || 'Unknown',
        category_color: buffer.meeting_categories?.color || '#6b7280',
        weekly_hours: parseFloat(buffer.weekly_hours.toString()),
        hours_spent: 0,
        hours_remaining: parseFloat(buffer.weekly_hours.toString()),
        utilization_percentage: 0
      }
      
      return {
        ...buffer,
        utilization: util || fallbackUtil
      }
    })
    
    console.log('[BUFFER DEBUG] Buffers with utilization:', buffersWithUtilization)
    
    // Use passed settings instead of fetching

    // Get empty slots but filter out times before Morning Routine
    const allEmptySlots = findEmptyTimeSlots(weekStart, weekEnd, conflictMaps, getWorkHoursRange, settings || undefined)
    
    // Filter out slots before Morning Routine on each day
    const morningRoutineHabit = habits.find(habit => habit.name === 'Morning Routine')
    
    const emptySlots = allEmptySlots.filter(slot => {
      // Filter out slots before Morning Routine
      if (morningRoutineHabit && morningRoutineHabit.habits_daily_logs) {
        const dailyLog = morningRoutineHabit.habits_daily_logs.find(log => log.log_date === slot.dateStr)
        const effectiveStartTime = dailyLog?.scheduled_start_time || morningRoutineHabit.current_start_time
        if (effectiveStartTime) {
          const [morningHour, morningMinute] = effectiveStartTime.split(':').map(Number)
          const morningTimeInHours = morningHour + morningMinute / 60
          
          // Only include slots that are at or after the Morning Routine time
          if (slot.timeInHours < morningTimeInHours) {
            return false
          }
        }
      }
      
      return true
    })
    
    console.log('[BUFFER DEBUG] Empty slots found:', emptySlots.length)
    
    const calculatedBufferBlocks = prioritizeBufferPlacement(buffersWithUtilization, emptySlots, settings || undefined)
    console.log('[BUFFER DEBUG] Calculated buffer blocks:', calculatedBufferBlocks)
    
    return calculatedBufferBlocks
  } catch (error) {
    console.error('[BUFFER DEBUG] Error in buffer calculation:', error)
    return []
  }
}