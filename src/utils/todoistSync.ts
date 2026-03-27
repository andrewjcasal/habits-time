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

function parseDurationFromTitle(title: string): { cleanTitle: string; hours: number } {
  const match = title.match(/\[(\d+)\]/)
  if (match) {
    const minutes = parseInt(match[1], 10)
    return { cleanTitle: title.replace(match[0], '').trim(), hours: minutes / 60 }
  }
  return { cleanTitle: title, hours: 0.5 }
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
    .from('cassian_tasks')
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
    const rows = newTasks.map((t) => {
      const { cleanTitle, hours } = parseDurationFromTitle(t.content)
      return {
        todoist_task_id: t.id,
        source: 'todoist',
        title: cleanTitle,
        description: t.description || null,
        priority: mapTodoistPriority(t.priority),
        due_date: t.due?.date || null,
        estimated_hours: hours,
        project_id: null,
        user_id: userId,
      }
    })

    const { data: inserted, error: insertError } = await supabase
      .from('cassian_tasks')
      .insert(rows)
      .select()

    if (insertError) {
      throw new Error(`Failed to insert new todoist tasks: ${insertError.message}`)
    }
    insertedTasks = inserted || []
  }

  // Update existing tasks with latest data from Todoist (due_date, title may change)
  const existingActive = (existingTasks || []).filter((t) => !t.is_complete)
  const apiTaskMap = new Map(todoistApiTasks.map((t) => [t.id, t]))
  for (const dbTask of existingActive) {
    const apiTask = apiTaskMap.get(dbTask.todoist_task_id)
    if (!apiTask) continue
    const newDueDate = apiTask.due?.date || null
    const { cleanTitle: newTitle, hours: newHours } = parseDurationFromTitle(apiTask.content)
    const newPriority = mapTodoistPriority(apiTask.priority)
    if (dbTask.due_date !== newDueDate || dbTask.title !== newTitle || dbTask.priority !== newPriority || dbTask.estimated_hours !== newHours) {
      await supabase
        .from('cassian_tasks')
        .update({ due_date: newDueDate, title: newTitle, priority: newPriority, estimated_hours: newHours })
        .eq('id', dbTask.id)
    }
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
      .from('cassian_tasks')
      .update({ is_complete: true, status: 'completed' })
      .in('id', ids)

    if (updateError) {
      throw new Error(`Failed to mark removed todoist tasks as complete: ${updateError.message}`)
    }
  }

  // Compute active tasks from what we already have (no extra query)
  const remainingActive = (existingTasks || []).filter(
    (t) => !t.is_complete && !removedIds.has(t.id)
  )
  return [...remainingActive, ...insertedTasks]
}
