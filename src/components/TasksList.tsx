import { useState } from 'react'
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { Task, Project } from '../types'

interface TasksListProps {
  tasks: Task[]
  tasksLoading: boolean
  fullWidth?: boolean
  selectedProject: Project | null
  onShowNewTaskForm?: () => void
  onAddTask: (taskData: any) => Promise<void>
  onTaskClick: (task: Task) => void
  onToggleTaskStatus: (task: Task) => void
  onUpdateTask: (taskId: string, data: any) => Promise<void>
}

const TasksList = ({
  tasks,
  tasksLoading,
  fullWidth = false,
  selectedProject,
  onShowNewTaskForm,
  onAddTask,
  onTaskClick,
  onToggleTaskStatus,
  onUpdateTask,
}: TasksListProps) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [showCompletedTasks, setShowCompletedTasks] = useState<boolean>(false)
  const [showInlineForm, setShowInlineForm] = useState<boolean>(false)
  const [newTaskTitle, setNewTaskTitle] = useState<string>('')
  const [newTaskDescription, setNewTaskDescription] = useState<string>('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState<number>(1)
  const [isSaving, setIsSaving] = useState<boolean>(false)

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

  const handleShowInlineForm = () => {
    setShowInlineForm(true)
  }

  const handleCancelInlineForm = () => {
    setShowInlineForm(false)
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskPriority('medium')
    setNewTaskEstimatedHours(1)
  }

  const handleSaveTask = async () => {
    if (!newTaskTitle.trim() || !selectedProject) return

    setIsSaving(true)
    try {
      await onAddTask({
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        estimated_hours: newTaskEstimatedHours,
        status: 'todo',
        project_id: selectedProject.id
      })
      handleCancelInlineForm()
    } catch (error) {
      console.error('Error saving task:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Separate completed and non-completed tasks
  const completedTasks = tasks.filter(task => task.status === 'completed')
  const activeTasks = tasks.filter(task => task.status !== 'completed')

  const renderTask = (task: Task) => (
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
              <div className="w-10 px-1 py-0.5 text-xs text-center text-neutral-500">
                {task.subtasks && task.subtasks.length > 0 
                  ? task.subtasks.reduce((total, subtask) => total + (subtask.estimated_hours || 0), 0)
                  : task.estimated_hours || 0
                }
              </div>
              <span className="text-xs text-neutral-500">h</span>
            </div>
          </div>
          {task.description && (
            <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
              {task.description}
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <select
              value={task.priority}
              onChange={e => {
                e.stopPropagation()
                onUpdateTask(task.id, { priority: e.target.value })
              }}
              onClick={e => e.stopPropagation()}
              onFocus={e => e.stopPropagation()}
              className={`text-xs font-medium border border-transparent rounded px-1 py-0.5 hover:border-neutral-300 focus:border-primary-500 focus:outline-none ${getPriorityColor(task.priority)} bg-transparent`}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
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
  )

  const renderInlineTaskForm = () => (
    <div className="py-3 px-2 border-b border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Task title"
          className="flex-1 px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSaveTask()
            }
            if (e.key === 'Escape') {
              handleCancelInlineForm()
            }
          }}
        />

        <select
          value={newTaskPriority}
          onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
          className="px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            value={newTaskEstimatedHours}
            onChange={(e) => setNewTaskEstimatedHours(Number(e.target.value) || 1)}
            min="0.25"
            step="0.25"
            className="w-16 px-2 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-primary-500"
          />
          <span className="text-xs text-neutral-600">h</span>
        </div>

        <button
          onClick={handleSaveTask}
          disabled={!newTaskTitle.trim() || isSaving}
          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )

  return (
    <div className={`${fullWidth ? 'w-full' : 'w-1/2'} flex flex-col`}>
      {/* Custom Header with Add Button */}
      <div className="px-2 py-1 flex items-center justify-between border-b border-neutral-200 bg-white">
        <h3 className="text-md font-medium text-neutral-900">Tasks</h3>
        {!showInlineForm && (
          <button
            onClick={handleShowInlineForm}
            className="flex items-center gap-1 px-2 py-1 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showInlineForm && renderInlineTaskForm()}

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
            {/* Active Tasks */}
            {activeTasks.map(task => renderTask(task))}
            
            {/* Completed Tasks Section */}
            {completedTasks.length > 0 && (
              <div className="border-t border-neutral-200 mt-4">
                <button
                  onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                  className="w-full px-2 py-1 flex items-center justify-between text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {showCompletedTasks ? (
                      <ChevronDown className="w-2 h-2" />
                    ) : (
                      <ChevronRight className="w-2 h-2" />
                    )}
                    Show completed tasks ({completedTasks.length})
                  </span>
                </button>
                
                {showCompletedTasks && (
                  <div className="space-y-0">
                    {completedTasks.map(task => renderTask(task))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TasksList
