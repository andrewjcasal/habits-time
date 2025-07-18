import { useState, useEffect } from 'react'
import { X, CheckCircle2, Circle, Clock } from 'lucide-react'
import { Task, Project } from '../types'

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTask: Task | null
  selectedProject: Project | null
  onAddTask: (taskData: any) => Promise<void>
  onUpdateTask: (taskId: string, data: any) => Promise<void>
  onRefetchTasks: () => Promise<void>
  onToggleTaskStatus: (task: Task) => Promise<void>
}

const TaskModal = ({ 
  isOpen, 
  onClose, 
  selectedTask, 
  selectedProject, 
  onAddTask,
  onUpdateTask,
  onRefetchTasks,
  onToggleTaskStatus
}: TaskModalProps) => {
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    estimated_hours: 1,
  })

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
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />
      default:
        return <Circle className="w-4 h-4 text-gray-400" />
    }
  }

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !selectedTask) return

    try {
      const taskData = {
        project_id: selectedProject.id,
        title: newSubtask.title,
        priority: newSubtask.priority,
        status: 'todo' as const,
        ...(newSubtask.description && { description: newSubtask.description }),
        ...(newSubtask.estimated_hours && { estimated_hours: newSubtask.estimated_hours }),
        ...(selectedTask.id && { parent_task_id: selectedTask.id }),
      }

      await onAddTask(taskData)
      
      // Refresh tasks to get updated subtasks
      await onRefetchTasks()
      
      setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 })
      setShowAddSubtask(false)
    } catch (error) {
      console.error('Error creating subtask:', error)
    }
  }

  const handleClose = () => {
    setShowAddSubtask(false)
    setNewSubtask({ title: '', description: '', priority: 'medium', estimated_hours: 1 })
    onClose()
  }

  if (!isOpen || !selectedTask) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">{selectedTask.title}</h2>
          <button
            onClick={handleClose}
            className="text-neutral-500 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                selectedTask.status === 'todo'
                  ? 'bg-gray-100 text-gray-800'
                  : selectedTask.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {selectedTask.status.replace('_', ' ')}
            </span>
            <span
              className={`text-sm font-medium ${getPriorityColor(selectedTask.priority)}`}
            >
              {selectedTask.priority} priority
            </span>
            {selectedTask.estimated_hours && (
              <span className="text-sm text-neutral-600">
                {selectedTask.estimated_hours} hours estimated
              </span>
            )}
          </div>

          {selectedTask.description && (
            <div>
              <h3 className="text-sm font-medium text-neutral-900 mb-2">Description</h3>
              <p className="text-sm text-neutral-600">{selectedTask.description}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-900">Subtasks</h3>
              <button
                onClick={() => setShowAddSubtask(true)}
                className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Add Subtask
              </button>
            </div>

            {showAddSubtask && (
              <div className="mb-2 p-2 border border-neutral-200 rounded bg-neutral-50">
                <form onSubmit={handleCreateSubtask} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Subtask title"
                    value={newSubtask.title}
                    onChange={e =>
                      setNewSubtask({
                        ...newSubtask,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 border border-neutral-300 rounded text-sm"
                    required
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <select
                      value={newSubtask.priority}
                      onChange={e =>
                        setNewSubtask({
                          ...newSubtask,
                          priority: e.target.value as 'low' | 'medium' | 'high',
                        })
                      }
                      className="flex-1 px-2 py-1 border border-neutral-300 rounded text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={newSubtask.estimated_hours}
                        onChange={e =>
                          setNewSubtask({
                            ...newSubtask,
                            estimated_hours: Math.max(
                              0.5,
                              parseFloat(e.target.value) || 0.5
                            ),
                          })
                        }
                        min="0.5"
                        step="0.5"
                        className="w-14 px-1 py-1 border border-neutral-300 rounded text-sm text-center"
                      />
                      <span className="text-xs text-neutral-500">h</span>
                    </div>
                  </div>
                  <div className="flex gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubtask(false)
                        setNewSubtask({
                          title: '',
                          description: '',
                          priority: 'medium',
                          estimated_hours: 1,
                        })
                      }}
                      className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-2">
              {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                selectedTask.subtasks.map(subtask => (
                  <div
                    key={subtask.id}
                    className="p-3 border border-neutral-200 rounded bg-neutral-50"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggleTaskStatus(subtask)}
                        className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                      >
                        {getTaskStatusIcon(subtask.status)}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4
                            className={`text-sm font-medium leading-tight ${
                              subtask.status === 'completed'
                                ? 'line-through text-neutral-500'
                                : 'text-neutral-900'
                            }`}
                          >
                            {subtask.title}
                          </h4>
                          {subtask.estimated_hours && (
                            <span className="text-xs text-neutral-500 flex-shrink-0">
                              {subtask.estimated_hours}h
                            </span>
                          )}
                        </div>
                        {subtask.description && (
                          <p className="text-xs text-neutral-600 mb-2">
                            {subtask.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium ${getPriorityColor(
                              subtask.priority
                            )}`}
                          >
                            {subtask.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-neutral-500 text-center py-4">
                  No subtasks yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskModal