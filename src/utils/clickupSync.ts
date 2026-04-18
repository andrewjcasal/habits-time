import { supabase } from '../lib/supabase'

// Minimal shape of the ClickUp task rows returned by our edge function.
// See https://clickup.com/api — only the fields we actually read are typed.
export interface ClickUpApiTask {
  id: string
  name: string
  description?: string | null
  status?: { status?: string; type?: string } | null
  priority?: { priority?: string } | null
  due_date?: string | null // milliseconds since epoch, as a string
  time_estimate?: number | null // milliseconds
  team_id?: string
  team_name?: string
  url?: string
}

// ClickUp's priority scale:
//   1 = Urgent, 2 = High, 3 = Normal, 4 = Low
function mapClickUpPriority(priority: string | undefined | null): string {
  switch (priority) {
    case 'urgent':
    case 'high':
      return 'high'
    case 'normal':
      return 'medium'
    case 'low':
    default:
      return 'low'
  }
}

function toYmd(msString: string | null | undefined): string | null {
  if (!msString) return null
  const n = Number(msString)
  if (!Number.isFinite(n)) return null
  const d = new Date(n)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function estimateHours(timeEstimateMs: number | null | undefined): number {
  if (!timeEstimateMs || timeEstimateMs <= 0) return 0.5 // sane default
  const hours = timeEstimateMs / (1000 * 60 * 60)
  // Snap to quarter-hour to match the scheduler's 15-min granularity.
  const snapped = Math.max(0.25, Math.round(hours * 4) / 4)
  return snapped
}

export async function syncClickUpTasks(
  clickupTasks: ClickUpApiTask[],
  userId: string
) {
  const { data: existingTasks, error: fetchError } = await supabase
    .from('cassian_tasks')
    .select('*')
    .eq('source', 'clickup')
    .eq('user_id', userId)

  if (fetchError) {
    throw new Error(`Failed to fetch existing ClickUp tasks: ${fetchError.message}`)
  }

  const existingByClickupId = new Map(
    (existingTasks || []).map(t => [t.clickup_task_id, t])
  )
  const apiTaskIds = new Set(clickupTasks.map(t => t.id))

  // Insert new.
  const newTasks = clickupTasks.filter(t => !existingByClickupId.has(t.id))
  let insertedTasks: any[] = []
  if (newTasks.length > 0) {
    const rows = newTasks.map(t => ({
      clickup_task_id: t.id,
      source: 'clickup',
      title: t.name,
      description: t.description || null,
      priority: mapClickUpPriority(t.priority?.priority),
      due_date: toYmd(t.due_date),
      estimated_hours: estimateHours(t.time_estimate),
      project_id: null,
      user_id: userId,
    }))
    const { data: inserted, error: insertError } = await supabase
      .from('cassian_tasks')
      .insert(rows)
      .select()
    if (insertError) {
      throw new Error(`Failed to insert new ClickUp tasks: ${insertError.message}`)
    }
    insertedTasks = inserted || []
  }

  // Refresh active tasks with the latest server-side fields.
  const existingActive = (existingTasks || []).filter(t => !t.is_complete)
  const apiTaskMap = new Map(clickupTasks.map(t => [t.id, t]))
  for (const dbTask of existingActive) {
    const apiTask = apiTaskMap.get(dbTask.clickup_task_id)
    if (!apiTask) continue
    const newDueDate = toYmd(apiTask.due_date)
    const newTitle = apiTask.name
    const newPriority = mapClickUpPriority(apiTask.priority?.priority)
    const newHours = estimateHours(apiTask.time_estimate)
    if (
      dbTask.due_date !== newDueDate ||
      dbTask.title !== newTitle ||
      dbTask.priority !== newPriority ||
      dbTask.estimated_hours !== newHours
    ) {
      await supabase
        .from('cassian_tasks')
        .update({
          due_date: newDueDate,
          title: newTitle,
          priority: newPriority,
          estimated_hours: newHours,
        })
        .eq('id', dbTask.id)
    }
  }

  // Tasks that disappeared from ClickUp (closed / unassigned / deleted) get
  // flipped to complete so the scheduler stops placing them.
  const removedIds = new Set<string>()
  const removedTasks = (existingTasks || []).filter(
    t => !t.is_complete && !apiTaskIds.has(t.clickup_task_id)
  )
  if (removedTasks.length > 0) {
    const ids = removedTasks.map(t => t.id)
    ids.forEach(id => removedIds.add(id))
    const { error: updateError } = await supabase
      .from('cassian_tasks')
      .update({ is_complete: true, status: 'completed' })
      .in('id', ids)
    if (updateError) {
      throw new Error(`Failed to mark removed ClickUp tasks as complete: ${updateError.message}`)
    }
  }

  const remainingActive = (existingTasks || []).filter(
    t => !t.is_complete && !removedIds.has(t.id)
  )
  return [...remainingActive, ...insertedTasks]
}
