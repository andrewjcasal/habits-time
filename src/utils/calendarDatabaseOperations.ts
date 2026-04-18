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

    // Prefer updating any existing log for this (habit, user, date). Order by
    // is_skipped ASC so a non-skipped log is picked over a skipped one when
    // both exist. This also lets us revive a previously-skipped row (e.g. the
    // user moves an occurrence back onto a day they skipped earlier) instead
    // of INSERTing and tripping the unique constraint on
    // (habit_id, user_id, log_date, scheduled_start_time).
    const { data: existing } = await supabase
      .from('cassian_habits_daily_logs')
      .select('id, is_skipped')
      .eq('habit_id', habitId)
      .eq('user_id', user.id)
      .eq('log_date', date)
      .order('is_skipped', { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      const patch: any = { scheduled_start_time: newTime, is_skipped: false }
      if (newDuration !== undefined) patch.duration = newDuration
      const { error } = await supabase
        .from('cassian_habits_daily_logs')
        .update(patch)
        .eq('id', existing.id)
      if (error) throw error
      return
    }

    const insertData: any = {
      habit_id: habitId,
      user_id: user.id,
      log_date: date,
      scheduled_start_time: newTime,
    }
    if (newDuration !== undefined) insertData.duration = newDuration

    const { error } = await supabase
      .from('cassian_habits_daily_logs')
      .insert(insertData)
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

    // Flip any existing non-skipped logs for this (habit, user, date) to
    // is_skipped = true. Upserting on scheduled_start_time would otherwise
    // create a duplicate row (one skipped, one still scheduled), leaving the
    // habit visible.
    const { data: existing, error: selectError } = await supabase
      .from('cassian_habits_daily_logs')
      .select('id')
      .eq('habit_id', habitId)
      .eq('user_id', user.id)
      .eq('log_date', date)
      .or('is_skipped.is.null,is_skipped.eq.false')

    if (selectError) throw selectError

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('cassian_habits_daily_logs')
        .update({ is_skipped: true })
        .in('id', existing.map(r => r.id))
      if (error) throw error
      return
    }

    // No prior log — insert a bare skipped row so the habit is suppressed
    // for the day even without a scheduled time on it.
    const { error } = await supabase
      .from('cassian_habits_daily_logs')
      .insert({
        habit_id: habitId,
        user_id: user.id,
        log_date: date,
        is_skipped: true,
        scheduled_start_time: null,
      })
    if (error) throw error
  } catch (error) {
    console.error('Error skipping habit:', error)
    throw error
  }
}

export interface CompletedTaskInfo {
  taskId: string
  source?: string
  todoistTaskId?: string
  clickupTaskId?: string
}

/**
 * Fast path: flip the task's `is_complete` flag and delete its scheduled
 * daily logs. Returns enough info for the caller to fire-and-forget the
 * external-API close + scheduler regen without blocking the modal close.
 */
export const handleCompleteTask = async (
  selectedTask: any
): Promise<CompletedTaskInfo | null> => {
  if (!selectedTask) return null
  try {
    const originalTaskId: string = selectedTask.id.includes('-chunk-')
      ? selectedTask.id.split('-chunk-')[0]
      : selectedTask.id

    // Resolve source + external id from whichever shape the caller handed us.
    // Task-daily-log rows carry the task under `.tasks`; direct task objects
    // have the fields on the task itself.
    const task = selectedTask.tasks || selectedTask
    const source = task?.source as string | undefined
    const todoistTaskId = task?.todoist_task_id as string | undefined
    const clickupTaskId = task?.clickup_task_id as string | undefined

    // Run the two local writes in parallel — they're independent.
    const [{ error: updateError }] = await Promise.all([
      supabase
        .from('cassian_tasks')
        .update({ is_complete: true, status: 'completed' })
        .eq('id', originalTaskId),
      supabase
        .from('cassian_tasks_daily_logs')
        .delete()
        .eq('task_id', originalTaskId),
    ])
    if (updateError) throw updateError

    return { taskId: originalTaskId, source, todoistTaskId, clickupTaskId }
  } catch (error) {
    console.error('Error completing task:', error)
    return null
  }
}

export const handleDeleteTask = async (selectedTask: any): Promise<string | null> => {
  if (!selectedTask) return null
  try {
    const originalTaskId = selectedTask.id.includes('-chunk-')
      ? selectedTask.id.split('-chunk-')[0]
      : selectedTask.id

    // Delete task daily logs first (FK constraint)
    await supabase.from('cassian_tasks_daily_logs').delete().eq('task_id', originalTaskId)

    const { error } = await supabase.from('cassian_tasks').delete().eq('id', originalTaskId)
    if (error) throw error
    return originalTaskId
  } catch (error) {
    console.error('Error deleting task:', error)
    return null
  }
}