import { supabase } from '../lib/supabase'

export interface TodoistApiTask {
  id: string
  content: string
  description: string
  labels: string[]
  priority: number // 1-4, where 4 is highest
  project_id: string
  due: { date: string; string: string } | null
  parent_id: string | null
}

function mapTodoistPriority(priority: number): string {
  switch (priority) {
    case 4:
      return 'high'
    case 3:
      return 'medium'
    case 2:
    case 1:
    default:
      return 'low'
  }
}

export async function syncTodoistTasks(
  todoistApiTasks: TodoistApiTask[],
  userId: string
) {
  // Fetch existing todoist tasks from DB
  const { data: existingTasks, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('source', 'todoist')
    .eq('user_id', userId)

  if (fetchError) {
    throw new Error(`Failed to fetch existing todoist tasks: ${fetchError.message}`)
  }

  const existingByTodoistId = new Map(
    (existingTasks || []).map((t) => [t.todoist_task_id, t])
  )

  const apiTaskIds = new Set(todoistApiTasks.map((t) => t.id))

  // Find new tasks (in API response but not yet in DB)
  const newTasks = todoistApiTasks.filter(
    (t) => !existingByTodoistId.has(t.id)
  )

  // Insert new tasks (with .select() to get the inserted rows back)
  let insertedTasks: any[] = []
  if (newTasks.length > 0) {
    const rows = newTasks.map((t) => ({
      todoist_task_id: t.id,
      source: 'todoist',
      title: t.content,
      description: t.description || null,
      priority: mapTodoistPriority(t.priority),
      due_date: t.due?.date || null,
      estimated_hours: 0.5,
      project_id: null,
      user_id: userId,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('tasks')
      .insert(rows)
      .select()

    if (insertError) {
      throw new Error(`Failed to insert new todoist tasks: ${insertError.message}`)
    }
    insertedTasks = inserted || []
  }

  // Mark tasks that were completed/deleted in Todoist (in DB but not in API response)
  const removedIds = new Set<string>()
  const removedTasks = (existingTasks || []).filter(
    (t) => !t.is_complete && !apiTaskIds.has(t.todoist_task_id)
  )

  if (removedTasks.length > 0) {
    const ids = removedTasks.map((t) => t.id)
    ids.forEach((id) => removedIds.add(id))

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ is_complete: true, status: 'done' })
      .in('id', ids)

    if (updateError) {
      throw new Error(`Failed to mark removed todoist tasks as complete: ${updateError.message}`)
    }
  }

  // Compute active tasks from what we already have (no extra query)
  const existingActive = (existingTasks || []).filter(
    (t) => !t.is_complete && !removedIds.has(t.id)
  )
  return [...existingActive, ...insertedTasks]
}
