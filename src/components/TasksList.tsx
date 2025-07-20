import { useState } from 'react'
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { Task } from '../types'
import SectionHeader from './SectionHeader'

interface TasksListProps {
  tasks: Task[]
  tasksLoading: boolean
  fullWidth?: boolean
  onShowNewTaskForm: () => void
  onTaskClick: (task: Task) => void
  onToggleTaskStatus: (task: Task) => void
  onUpdateTask: (taskId: string, data: any) => Promise<void>
}

const TasksList = ({
  tasks,
  tasksLoading,
  fullWidth = false,
  onShowNewTaskForm,
  onTaskClick,
  onToggleTaskStatus,
  onUpdateTask,
}: TasksListProps) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-red-600',
      medium: 'text-yellow-600',
      low: 'text-green-600',
    }
    return colors[priority as keyof typeof colors] || 'text-gray-600'
  }

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3 h-3 text-green-600" />
      case 'in_progress':
        return <Clock className="w-3 h-3 text-blue-600" />
      default:
        return <Circle className="w-3 h-3 text-gray-400" />
    }
  }

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  return (
    <div className={`${fullWidth ? 'w-full' : 'w-1/2'} flex flex-col`}>
      <SectionHeader
        title="Tasks"
        onAddClick={onShowNewTaskForm}
        className="border-b border-neutral-200 bg-white"
      />
      <div className="flex-1 overflow-y-auto">
        {tasksLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-neutral-500 text-sm">Loading tasks...</p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs text-neutral-400">Add tasks to get started</p>
          </div>
        ) : (
          <div className="space-y-0">
            {tasks.map(task => (
              <div
                key={task.id}
                className="py-2 px-2 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={() => onTaskClick(task)}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      onToggleTaskStatus(task)
                    }}
                    className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                  >
                    {getTaskStatusIcon(task.status)}
                  </button>
                  {task.subtasks && task.subtasks.length > 0 && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        toggleTaskExpansion(task.id)
                      }}
                      className="mt-0.5 hover:bg-neutral-100 p-0.5 rounded transition-colors flex-shrink-0"
                    >
                      {expandedTasks.has(task.id) ? (
                        <ChevronDown className="w-3 h-3 text-neutral-500" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-neutral-500" />
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-sm font-medium leading-tight ${
                          task.status === 'completed'
                            ? 'line-through text-neutral-500'
                            : 'text-neutral-900'
                        }`}
                      >
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {task.subtasks && task.subtasks.length > 0 ? (
                          // Show readonly total of subtask hours if subtasks exist
                          <>
                            <div className="w-10 px-1 py-0.5 text-xs text-center text-neutral-500">
                              {task.subtasks.reduce(
                                (total, subtask) => total + (subtask.estimated_hours || 0),
                                0
                              )}
                            </div>
                            <span className="text-xs text-neutral-500">h</span>
                          </>
                        ) : (
                          // Show editable input if no subtasks
                          <>
                            <input
                              type="number"
                              value={task.estimated_hours || 1}
                              onChange={e => {
                                e.stopPropagation()
                                const newHours = Math.max(0.5, parseFloat(e.target.value) || 0.5)
                                onUpdateTask(task.id, { estimated_hours: newHours })
                              }}
                              onClick={e => e.stopPropagation()}
                              onFocus={e => e.stopPropagation()}
                              min="0.5"
                              step="0.5"
                              className="w-10 px-1 py-0.5 text-xs border border-neutral-300 rounded text-center hover:border-neutral-400 focus:border-primary-500 focus:outline-none"
                            />
                            <span className="text-xs text-neutral-500">h</span>
                          </>
                        )}
                      </div>
                    </div>
                    {task.description && (
                      <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                        {task.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>

                    {/* Subtasks list */}
                    {task.subtasks && task.subtasks.length > 0 && expandedTasks.has(task.id) && (
                      <div className="mt-1 pl-2 border-l border-neutral-200 space-y-0">
                        {task.subtasks.map(subtask => (
                          <div key={subtask.id} className="flex items-center gap-1 py-0.5">
                            <div className="flex-1 min-w-0">
                              <span
                                className={`text-xs ${
                                  subtask.status === 'completed'
                                    ? 'line-through text-neutral-500'
                                    : 'text-neutral-700'
                                }`}
                              >
                                {subtask.title}
                              </span>
                            </div>
                            {subtask.estimated_hours && (
                              <span className="text-xs text-neutral-500 flex-shrink-0">
                                {subtask.estimated_hours}h
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TasksList
