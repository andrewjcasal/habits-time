/**
 * Calculate pull-back time for habits with pull_back_15min scheduling rule
 * 
 * This function calculates the effective start time for habits that use the pull-back scheduling rule,
 * which moves the habit earlier by 15 minutes each day, with a minimum time of 6:00 AM.
 * 
 * @param habit - The habit object containing habits_daily_logs and current_start_time
 * @param dateKey - The date key in 'yyyy-MM-dd' format
 * @param baseStartTime - The base start time to use if no daily log exists
 * @returns The calculated start time in 'HH:MM' format
 */
export const calculatePullBackTime = (habit: any, dateKey: string, baseStartTime: string): string => {
  // Find the most recent habit_daily_log to start from
  const sortedLogs = (habit.habits_daily_logs || [])
    .filter((log: any) => log.log_date <= dateKey)
    .sort((a: any, b: any) => b.log_date.localeCompare(a.log_date))
  
  const mostRecentLog = sortedLogs[0]
  
  // If we have a recent log with a scheduled start time, use that as the reference
  let referenceTime = mostRecentLog?.scheduled_start_time || baseStartTime
  let referenceDate = mostRecentLog?.log_date || dateKey
  
  // Calculate how many days forward from the reference date
  const daysDifference = Math.floor((new Date(dateKey).getTime() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysDifference <= 0) {
    return referenceTime // Same day or past day, use reference time
  }
  
  // Parse the reference time
  const [hours, minutes] = referenceTime.split(':').map(Number)
  let totalMinutes = hours * 60 + minutes
  
  // Pull back 15 minutes for each day forward
  totalMinutes -= (daysDifference * 15)
  
  // Allow early morning hours since calendar now shows 0-4am
  // Ensure minimum time is 12:00 AM (0 minutes from midnight)
  totalMinutes = Math.max(totalMinutes, 0)
  
  // Convert back to HH:MM format
  const newHours = Math.floor(totalMinutes / 60)
  const newMinutes = totalMinutes % 60
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
}

/**
 * Get the effective start time for a habit, applying pull-back scheduling if needed
 * 
 * @param habit - The habit object
 * @param dateKey - The date key in 'yyyy-MM-dd' format
 * @param dailyLog - Optional daily log for the specific date
 * @returns The effective start time in 'HH:MM' format
 */
export const getEffectiveHabitStartTime = (habit: any, dateKey: string, dailyLog?: any): string => {
  // Get base start time from daily log or habit default
  let effectiveStartTime = dailyLog?.scheduled_start_time || habit.current_start_time
  
  // Apply pull-back scheduling rule if applicable
  if (habit.habits_types?.scheduling_rule === 'pull_back_15min' && effectiveStartTime) {
    effectiveStartTime = calculatePullBackTime(habit, dateKey, effectiveStartTime)
  }
  
  return effectiveStartTime
}