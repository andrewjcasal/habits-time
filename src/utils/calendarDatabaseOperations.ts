import { supabase } from '../lib/supabase'

export const handleHabitTimeChange = async (
  habitId: string, 
  date: string, 
  newTime: string, 
  newDuration?: number
) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Prepare the data to update
    const updateData: any = {
      habit_id: habitId,
      user_id: user.id,
      log_date: date,
      scheduled_start_time: newTime,
    }

    // Only include duration if it's provided
    if (newDuration !== undefined) {
      updateData.duration = newDuration
    }

    // Insert or update the daily log with the new scheduled start time and optionally duration
    const { error } = await supabase.from('habits_daily_logs').upsert(
      updateData,
      {
        onConflict: 'habit_id,user_id,log_date',
      }
    )

    if (error) throw error
  } catch (error) {
    console.error('Error updating habit:', error)
    throw error
  }
}

export const handleHabitSkip = async (
  habitId: string, 
  date: string
) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Insert or update the daily log to mark as skipped
    const { error } = await supabase.from('habits_daily_logs').upsert(
      {
        habit_id: habitId,
        user_id: user.id,
        log_date: date,
        is_skipped: true,
        scheduled_start_time: null, // Clear any scheduled time
      },
      {
        onConflict: 'habit_id,user_id,log_date',
      }
    )

    if (error) throw error
  } catch (error) {
    console.error('Error skipping habit:', error)
    throw error
  }
}

export const handleCompleteTask = async (selectedTask: any) => {
  if (!selectedTask) return
  try {
    const originalTaskId = selectedTask.id.includes('-chunk-')
      ? selectedTask.id.split('-chunk-')[0]
      : selectedTask.id

    const { error } = await supabase
      .from('tasks')
      .update({ is_complete: true })
      .eq('id', originalTaskId)

    if (error) throw error
    window.location.reload()
  } catch (error) {
    console.error('Error completing task:', error)
  }
}

export const handleDeleteTask = async (selectedTask: any) => {
  if (!selectedTask) return
  try {
    const originalTaskId = selectedTask.id.includes('-chunk-')
      ? selectedTask.id.split('-chunk-')[0]
      : selectedTask.id

    const { error } = await supabase.from('tasks').delete().eq('id', originalTaskId)
    if (error) throw error
    window.location.reload()
  } catch (error) {
    console.error('Error deleting task:', error)
  }
}