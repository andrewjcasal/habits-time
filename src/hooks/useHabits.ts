import { useState, useEffect } from 'react'
import { supabase, Habit, HabitDailyLog, HabitWithType } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useHabits(selectedDate?: string) {
  const { user } = useAuth()
  const [habits, setHabits] = useState<HabitWithType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sleepStartTime, setSleepStartTime] = useState<string | null>(null)

  const fetchHabits = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Use selected date or local date instead of UTC date
      const now = new Date()
      const today =
        selectedDate ||
        new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
      console.log(
        'Fetching habits for user:',
        user.id,
        'local date:',
        today,
        'UTC would be:',
        new Date().toISOString().split('T')[0]
      )

      // Check if we should auto-uncheck habits based on sleep start time
      await checkAndResetHabitsAfterSleep()

      // Also check visible habits
      const { data: visibleHabits, error: visibleError } = await supabase
        .from('habits')
        .select('*')
        .eq('is_visible', true)

      

      // Get the most recent sleep start time from habits_time_logs
      const { data: recentSleep } = await supabase
        .from('habits_time_logs')
        .select('start_time')
        .eq('user_id', user.id)
        .eq('activity_type_id', '951bc26a-a863-4996-8a02-f4da2d148aa9') // sleep activity type
        .order('start_time', { ascending: false })
        .limit(1)
        .single()

      let currentSleepStartTime: string | null = null
      if (recentSleep?.start_time) {
        const sleepDate = new Date(recentSleep.start_time)
        currentSleepStartTime = sleepDate.toTimeString().split(' ')[0] // Get HH:MM:SS format
        
      }

      setSleepStartTime(currentSleepStartTime)

      // Build the query - show all habits and include recent daily logs for pull-back calculation
      let query = supabase
        .from('habits')
        .select(
          `
          *,
          habits_types (*),
          habits_daily_logs (
            *
          )
        `
        )
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq('is_visible', true)
        // Include logs from the last 30 days for pull-back calculations
        .gte('habits_daily_logs.log_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

      const { data, error } = await query.order('current_start_time', { ascending: true })

      if (error) throw error

      setHabits(data || [])
    } catch (err) {
      console.error('Error fetching habits:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const logHabitCompletion = async (
    habitId: string,
    isCompleted: boolean,
    actualStartTime?: string,
    actualEndTime?: string,
    notes?: string
  ) => {
    if (!user) return

    try {
      const logDate = selectedDate || new Date().toISOString().split('T')[0]
      const habit = habits.find(h => h.id === habitId)

      const logData = {
        habit_id: habitId,
        user_id: user.id,
        log_date: logDate,
        scheduled_start_time: habit?.current_start_time,
        actual_start_time: actualStartTime,
        actual_end_time: actualEndTime,
        is_completed: isCompleted,
        notes: notes,
      }

      const { error } = await supabase.from('habits_daily_logs').upsert(logData, {
        onConflict: 'habit_id,user_id,log_date',
      })

      if (error) throw error

      // Update local state
      setHabits(prevHabits =>
        prevHabits.map(habit => {
          if (habit.id === habitId) {
            const existingLog = habit.habits_daily_logs?.[0]
            const updatedLog = {
              ...existingLog,
              ...logData,
              id: existingLog?.id || '',
              created_at: existingLog?.created_at || new Date().toISOString(),
            }

            return {
              ...habit,
              habits_daily_logs: [updatedLog],
            }
          }
          return habit
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log habit')
    }
  }

  const updateHabitStartTime = async (habitId: string, newTime: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('habits')
        .update({ current_start_time: newTime })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setHabits(prevHabits =>
        prevHabits.map(habit =>
          habit.id === habitId ? { ...habit, current_start_time: newTime } : habit
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit time')
    }
  }

  const updateHabitType = async (habitId: string, habitTypeId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('habits')
        .update({ habit_type_id: habitTypeId })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) throw error

      // Refresh habits to get updated type information
      await fetchHabits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit type')
    }
  }

  const updateHabitDuration = async (habitId: string, newDuration: number) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('habits')
        .update({ duration: newDuration })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setHabits(prevHabits =>
        prevHabits.map(habit =>
          habit.id === habitId ? { ...habit, duration: newDuration } : habit
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit duration')
    }
  }

  const deleteHabit = async (habitId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('habits')
        .update({ is_visible: false })
        .eq('id', habitId)
        .eq('user_id', user.id)

      if (error) throw error

      // Remove from local state
      setHabits(prevHabits => prevHabits.filter(habit => habit.id !== habitId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete habit')
      throw err
    }
  }

  const createHabit = async (habitData: {
    name: string
    duration: number
    habit_type_id: string
    default_start_time: string
    background: string
    benefits: string
    consequences: string
  }) => {
    if (!user) return

    try {
      const { error } = await supabase.from('habits').insert({
        name: habitData.name,
        user_id: user.id,
        duration: habitData.duration,
        habit_type_id: habitData.habit_type_id,
        default_start_time: habitData.default_start_time,
        current_start_time: habitData.default_start_time,
        background: habitData.background,
        benefits: habitData.benefits,
        consequences: habitData.consequences,
        is_visible: true,
      })

      if (error) throw error

      // Refresh habits to show the new habit
      await fetchHabits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit')
      throw err
    }
  }

  const updateHabitStartTimes = async () => {
    if (!user) return

    try {
      const { error } = await supabase.rpc('update_habit_start_times', {
        p_user_id: user.id,
      })

      if (error) throw error

      // Refresh habits to get updated times
      await fetchHabits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit times')
    }
  }

  const checkAndResetHabitsAfterSleep = async () => {
    if (!user) return

    try {
      const today = new Date().toISOString().split('T')[0]

      // Get the most recent sleep log
      const { data: sleepLog, error: sleepError } = await supabase
        .from('habits_time_logs')
        .select('start_time, end_time')
        .eq('user_id', user.id)
        .eq('activity_type_id', '951bc26a-a863-4996-8a02-f4da2d148aa9')
        .order('start_time', { ascending: false })
        .limit(1)
        .single()

      // Only reset if we found a sleep log AND it has ended (indicating wake up)
      if (sleepError || !sleepLog || !sleepLog.end_time) {
        
        return
      }

      const sleepStartTime = new Date(sleepLog.start_time)
      const sleepEndTime = new Date(sleepLog.end_time)
      const now = new Date()

      

      // Only reset habits if we've woken up from sleep (past end_time)
      // AND the sleep was from today (started after midnight today)
      const todayStart = new Date(today + 'T00:00:00Z')

      if (now > sleepEndTime && sleepStartTime >= todayStart) {
        
        // Reset all habit completions for today
        const { error: resetError } = await supabase
          .from('habits_daily_logs')
          .update({ is_completed: false })
          .eq('user_id', user.id)
          .eq('log_date', today)

        if (resetError) {
          console.error('Error resetting habits after sleep:', resetError)
        }
      } else {
        
      }
    } catch (err) {
      console.error('Error checking sleep status:', err)
    }
  }

  useEffect(() => {
    fetchHabits()
  }, [user, selectedDate])

  // Get next habit coming up (uncompleted habit with earliest start time after sleep)
  const getNextHabit = () => {
    // Filter for uncompleted habits that occur after sleep time
    const uncompletedHabitsAfterSleep = habits.filter(habit => {
      const dailyLog = habit.habits_daily_logs?.[0]
      const isNotCompleted = !dailyLog?.actual_start_time

      // If not completed, check if it's after sleep time
      if (isNotCompleted && sleepStartTime && habit.current_start_time) {
        return habit.current_start_time > sleepStartTime
      }

      // If no sleep time or no start time, include all uncompleted habits
      return isNotCompleted
    })

    
    if (uncompletedHabitsAfterSleep.length === 0) {
      
      // If no uncompleted habits after sleep, default to first habit after sleep time
      const habitsAfterSleep = habits.filter(habit => {
        if (!sleepStartTime || !habit.current_start_time) return true
        return habit.current_start_time > sleepStartTime
      })

      
      return habitsAfterSleep[0] || habits[0]
    }

    // Sort by start time and return the earliest
    return uncompletedHabitsAfterSleep.sort((a, b) => {
      const timeA = a.current_start_time || '23:59'
      const timeB = b.current_start_time || '23:59'
      return timeA.localeCompare(timeB)
    })[0]
  }

  return {
    habits,
    loading,
    error,
    logHabitCompletion,
    updateHabitStartTime,
    updateHabitType,
    updateHabitDuration,
    deleteHabit,
    createHabit,
    updateHabitStartTimes,
    refetch: fetchHabits,
    getNextHabit,
  }
}
