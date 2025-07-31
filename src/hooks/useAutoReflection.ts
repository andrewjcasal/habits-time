import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { useReflections } from './useReflections'
import { supabase } from '../lib/supabase'

export function useAutoReflection() {
  const { user } = useAuth()
  const { generateReflection, getTodaysReflection } = useReflections()
  const location = useLocation()
  const hasCheckedToday = useRef<string | null>(null)

  useEffect(() => {
    const checkAndGenerateReflection = async () => {
      if (!user) return

      const today = new Date().toISOString().split('T')[0]
      
      // Skip if we already checked today
      if (hasCheckedToday.current === today) return
      
      try {
        // Check if we already have a reflection for today
        const existingReflection = await getTodaysReflection()
        if (existingReflection) {
          hasCheckedToday.current = today
          return
        }

        // Check if any habits were completed in the last 3 days
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        const { data: completedHabits } = await supabase
          .from('habits_daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('log_date', threeDaysAgo)
          .lte('log_date', today)
          .eq('is_completed', true)

        // Check if any tasks were completed in the last 3 days
        const { data: completedTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('updated_at', threeDaysAgo + 'T00:00:00.000Z')
          .lt('updated_at', today + 'T23:59:59.999Z')

        const hasCompletions = (completedHabits && completedHabits.length > 0) || 
                             (completedTasks && completedTasks.length > 0)

        if (hasCompletions) {
          console.log('🎯 Auto-generating reflection due to completed habits/tasks in the last 3 days')
          await generateReflection(today)
        }

        hasCheckedToday.current = today
      } catch (error) {
        console.error('Error in auto-reflection check:', error)
      }
    }

    // Small delay to ensure the page has loaded
    const timeoutId = setTimeout(checkAndGenerateReflection, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [user, location.pathname, generateReflection, getTodaysReflection])
}