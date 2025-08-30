import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, Clock, Plus, Trash2, X } from 'lucide-react'
import { Task, Project } from '../types'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from '../components/LoadingSpinner'

const TaskDetail = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [task, setTask] = useState<Task | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    estimated_hours: 1,
  })

  const fetchTask = async () => {
    if (!taskId || !user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects (
            id,
            name,
            description
          ),
          subtasks:tasks!parent_task_id (
            *
          )
        `)
        .eq('id', taskId)
        .single()

      if (error) throw error

      setTask(data)
      setProject(data.projects)
    } catch (err) {
      console.error('Error fetching task:', err)
      navigate(-1) // Go back if task not found
    } finally {
      setLoading(false)
    }
  }

  const updateTask = async (updates: Partial<Task>) => {
    if (!task) return

    try {
      setSaving(true)
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', task.id)

      if (error) throw error

      setTask(prev => prev ? { ...prev, ...updates } : null)
    } catch (err) {
      console.error('Error updating task:', err)
    } finally {
      setSaving(false)
    }
  }

  const toggleTaskStatus = async () => {
    if (!task) return

    const newStatus = task.status === 'completed' ? 'todo' : 'completed'
    await updateTask({ status: newStatus })
  }

  const addSubtask = async () => {
    if (!newSubtask.title.trim() || !task || !project) return

    try {
      setSaving(true)
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newSubtask.title.trim(),
          description: newSubtask.description.trim() || null,
          priority: newSubtask.priority,
          estimated_hours: newSubtask.estimated_hours,
          status: 'todo',
          project_id: project.id,
          parent_task_id: task.id,
          user_id: user?.id
        })
        .select()
        .single()

      if (error) throw error

      // Add the new subtask to the current task
      setTask(prev => prev ? {
        ...prev,
        subtasks: [...(prev.subtasks || []), data]
      } : null)

      // Reset form
      setNewSubtask({
        title: '',
        description: '',
        priority: 'medium',
        estimated_hours: 1,
      })
      setShowAddSubtask(false)
    } catch (err) {
      console.error('Error adding subtask:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteTask = async () => {
    if (!task || !confirm('Are you sure you want to delete this task?')) return

    try {
      setSaving(true)
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)

      if (error) throw error

      navigate(-1) // Go back after deletion
    } catch (err) {
      console.error('Error deleting task:', err)
      setSaving(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: 'text-red-600',
      medium: 'text-yellow-600',
      low: 'text-green-600',
    }
    return colors[priority as keyof typeof colors] || 'text-gray-600'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  useEffect(() => {
    fetchTask()
  }, [taskId, user])

  if (loading) {
    return <LoadingSpinner message="Loading task..." />
  }

  if (!task) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Task not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {task.title}
            </h1>
            {project && (
              <p className="text-sm text-gray-500">
                in {project.name}
              </p>
            )}
          </div>
          {saving && <div className="text-sm text-gray-500">Saving...</div>}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Task Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTaskStatus}
            className="hover:scale-110 transition-transform"
          >
            {getStatusIcon(task.status)}
          </button>
          <span className="text-sm font-medium capitalize">
            {task.status.replace('_', ' ')}
          </span>
        </div>

        {/* Task Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={task.title}
              onChange={(e) => updateTask({ title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {task.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={task.description}
                onChange={(e) => updateTask({ description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => updateTask({ priority: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${getPriorityColor(task.priority)}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                value={task.estimated_hours || 0}
                onChange={(e) => updateTask({ estimated_hours: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.25"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              Subtasks ({task.subtasks?.length || 0})
            </h3>
            <button
              onClick={() => setShowAddSubtask(true)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {/* Add subtask form */}
          {showAddSubtask && (
            <div className="p-3 border border-gray-200 rounded-md bg-gray-50 mb-3">
              <div className="space-y-3">
                <input
                  type="text"
                  value={newSubtask.title}
                  onChange={(e) => setNewSubtask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Subtask title"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={addSubtask}
                    disabled={!newSubtask.title.trim() || saving}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddSubtask(false)}
                    className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Subtasks list */}
          {task.subtasks && task.subtasks.length > 0 ? (
            <div className="space-y-2">
              {task.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-3 p-2 border border-gray-200 rounded">
                  <div className="w-3 h-3">
                    {subtask.status === 'completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                    ) : (
                      <Circle className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm ${
                      subtask.status === 'completed' 
                        ? 'line-through text-gray-500' 
                        : 'text-gray-900'
                    }`}>
                      {subtask.title}
                    </span>
                  </div>
                  {subtask.estimated_hours && (
                    <span className="text-xs text-gray-500">
                      {subtask.estimated_hours}h
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No subtasks yet</p>
          )}
        </div>

        {/* Delete button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            onClick={deleteTask}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Task
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskDetail