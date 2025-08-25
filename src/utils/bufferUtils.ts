import { supabase } from '../lib/supabase'
import type { CategoryBuffer, BufferUtilization, BufferBlock } from '../types'

/**
 * Creates a new category buffer
 */
export async function createCategoryBuffer(
  categoryId: string,
  weeklyHours: number
): Promise<CategoryBuffer | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('category_buffers')
    .insert({
      user_id: user.id,
      category_id: categoryId,
      weekly_hours: weeklyHours
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating category buffer:', error)
    return null
  }

  return data
}

/**
 * Updates an existing category buffer
 */
export async function updateCategoryBuffer(
  bufferId: string,
  weeklyHours: number
): Promise<CategoryBuffer | null> {
  const { data, error } = await supabase
    .from('category_buffers')
    .update({ weekly_hours: weeklyHours })
    .eq('id', bufferId)
    .select()
    .single()

  if (error) {
    console.error('Error updating category buffer:', error)
    return null
  }

  return data
}

/**
 * Deletes a category buffer
 */
export async function deleteCategoryBuffer(bufferId: string): Promise<boolean> {
  const { error } = await supabase
    .from('category_buffers')
    .delete()
    .eq('id', bufferId)

  if (error) {
    console.error('Error deleting category buffer:', error)
    return false
  }

  return true
}

/**
 * Gets all category buffers for the current user
 */
export async function getCategoryBuffers(): Promise<CategoryBuffer[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('category_buffers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching category buffers:', error)
    return []
  }

  return data || []
}

/**
 * Gets buffer utilization for a specific week
 */
export async function getBufferUtilization(
  weekStart: Date,
  weekEnd: Date
): Promise<BufferUtilization[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .rpc('get_buffer_utilization', {
      p_user_id: user.id,
      p_week_start: weekStart.toISOString(),
      p_week_end: weekEnd.toISOString()
    })

  if (error) {
    console.error('Error fetching buffer utilization:', error)
    return []
  }

  return data || []
}

/**
 * Calculates buffer blocks to fill empty calendar slots
 */
export function calculateBufferBlocks(
  utilizations: BufferUtilization[],
  emptySlots: { start: Date; end: Date }[],
  weekStart: Date,
  weekEnd: Date
): BufferBlock[] {
  const bufferBlocks: BufferBlock[] = []
  
  // Sort utilizations by remaining hours (highest first)
  const sortedUtilizations = [...utilizations]
    .filter(u => u.hours_remaining > 0)
    .sort((a, b) => b.hours_remaining - a.hours_remaining)

  // Distribute buffer blocks across empty slots
  for (const utilization of sortedUtilizations) {
    let remainingHours = utilization.hours_remaining
    
    for (const slot of emptySlots) {
      if (remainingHours <= 0) break
      
      const slotDurationMs = slot.end.getTime() - slot.start.getTime()
      const slotDurationHours = slotDurationMs / (1000 * 60 * 60)
      
      // Use the minimum of remaining hours or slot duration
      const blockDurationHours = Math.min(remainingHours, slotDurationHours)
      
      if (blockDurationHours > 0) {
        const blockEndTime = new Date(slot.start.getTime() + (blockDurationHours * 60 * 60 * 1000))
        
        bufferBlocks.push({
          id: `buffer_${utilization.buffer_id}_${slot.start.getTime()}`,
          buffer_id: utilization.buffer_id,
          category_id: utilization.category_id,
          category_name: utilization.category_name,
          category_color: utilization.category_color,
          start_time: slot.start.toISOString(),
          end_time: blockEndTime.toISOString(),
          duration_hours: blockDurationHours,
          remaining_hours: remainingHours - blockDurationHours
        })
        
        remainingHours -= blockDurationHours
        
        // Update the slot to reflect the used time
        slot.start = blockEndTime
      }
    }
  }
  
  return bufferBlocks
}

/**
 * Gets the start and end of the current week
 */
export function getCurrentWeekBounds(dayStartHour: number = 5): { weekStart: Date; weekEnd: Date } {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate start of week (Monday at dayStartHour)
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysFromMonday)
  weekStart.setHours(dayStartHour, 0, 0, 0)
  
  // Calculate end of week (Sunday at dayStartHour)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  
  return { weekStart, weekEnd }
}

/**
 * Validates buffer creation/update parameters
 */
export function validateBufferInput(weeklyHours: number): { isValid: boolean; error?: string } {
  if (weeklyHours <= 0) {
    return { isValid: false, error: 'Weekly hours must be greater than 0' }
  }
  
  if (weeklyHours > 168) {
    return { isValid: false, error: 'Weekly hours cannot exceed 168 (24 hours × 7 days)' }
  }
  
  // Check for reasonable precision (max 2 decimal places)
  if (!Number.isInteger(weeklyHours * 100)) {
    return { isValid: false, error: 'Weekly hours can have at most 2 decimal places' }
  }
  
  return { isValid: true }
}