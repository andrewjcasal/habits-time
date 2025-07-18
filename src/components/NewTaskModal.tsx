import { useState } from 'react'
import { X } from 'lucide-react'
import { Project } from '../types'

interface NewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProject: Project | null
  onCreateTask: (taskData: any) => Promise<void>
}

const NewTaskModal = ({ isOpen, onClose, selectedProject, onCreateTask }: NewTaskModalProps) => {
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    estimated_hours: 1,
    is_billable: true,
  })

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject) return

    try {
      await onCreateTask({
        project_id: selectedProject.id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        estimated_hours: newTask.estimated_hours,
        is_billable: newTask.is_billable,
        status: 'todo',
      })
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        estimated_hours: 1,
        is_billable: true,
      })
      onClose()
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const handleClose = () => {
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      estimated_hours: 1,
      is_billable: true,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Create New Task</h2>
          <button onClick={handleClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCreateTask} className="space-y-4">
          <input
            type="text"
            placeholder="Task title"
            value={newTask.title}
            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newTask.description}
            onChange={e => setNewTask({ ...newTask, description: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm resize-none"
            rows={3}
          />
          <select
            value={newTask.priority}
            onChange={e =>
              setNewTask({
                ...newTask,
                priority: e.target.value as 'low' | 'medium' | 'high',
              })
            }
            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Estimated hours"
              value={newTask.estimated_hours}
              onChange={e =>
                setNewTask({
                  ...newTask,
                  estimated_hours: Math.max(0.5, parseFloat(e.target.value) || 0.5),
                })
              }
              min="0.5"
              step="0.5"
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
            />
            <span className="text-sm text-neutral-500">hours</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_billable"
              checked={newTask.is_billable}
              onChange={e => setNewTask({ ...newTask, is_billable: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_billable" className="text-sm text-neutral-700">
              Billable
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewTaskModal
