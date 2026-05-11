import { Task } from '../types'

export function groupTasksByParent(allTasks: Task[]): Task[] {
  const taskMap = new Map(allTasks.map(task => [task.id, { ...task, subtasks: [] as Task[] }]))
  const topLevelTasks: Task[] = []

  allTasks.forEach(task => {
    if (task.parent_task_id) {
      const parentTask = taskMap.get(task.parent_task_id)
      if (parentTask) {
        parentTask.subtasks = parentTask.subtasks || []
        parentTask.subtasks.push(taskMap.get(task.id)!)
      }
    } else {
      topLevelTasks.push(taskMap.get(task.id)!)
    }
  })

  return topLevelTasks
}
