import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'

interface Task {
  id: string
  title: string
  estimated_hours: number
  projects?: {
    name: string
    color?: string
  }
}

interface TaskDailyLogModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: Date
  selectedTimeSlot: { time: string; date: Date } | null
  onTaskLogCreated?: () => void
}

const TaskDailyLogModal = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  selectedTimeSlot,
  onTaskLogCreated 
}: TaskDailyLogModalProps) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [newTaskLog, setNewTaskLog] = useState({
    task_id: '',
    scheduled_start_time: '',
    estimated_hours: 1,
    notes: ''
  })

  // Load tasks when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTasks()
      // Pre-fill start time if we have a selected time slot
      if (selectedTimeSlot) {
        setNewTaskLog(prev => ({
          ...prev,
          scheduled_start_time: selectedTimeSlot.time
        }))
      }
    }
  }, [isOpen, selectedTimeSlot])

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          estimated_hours,
          projects (
            name,
            color
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'todo')
        .order('title')

      if (error) {
        console.error('Error fetching tasks:', error)
        return
      }

      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const handleCreateTaskLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskLog.task_id || !newTaskLog.scheduled_start_time) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Calculate end time
      const [startHour, startMinute] = newTaskLog.scheduled_start_time.split(':').map(Number)
      const startTimeInMinutes = startHour * 60 + startMinute
      const endTimeInMinutes = startTimeInMinutes + (newTaskLog.estimated_hours * 60)
      const endHour = Math.floor(endTimeInMinutes / 60)
      const endMinute = endTimeInMinutes % 60
      const scheduled_end_time = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`

      const { error } = await supabase
        .from('tasks_daily_logs')
        .insert({
          task_id: newTaskLog.task_id,
          user_id: user.id,
          log_date: format(selectedDate, 'yyyy-MM-dd'),
          scheduled_start_time: `${newTaskLog.scheduled_start_time}:00`,
          scheduled_end_time,
          estimated_hours: newTaskLog.estimated_hours,
          notes: newTaskLog.notes.trim() || null
        })

      if (error) {
        console.error('Error creating task log:', error)
        return
      }

      // Reset form
      setNewTaskLog({
        task_id: '',
        scheduled_start_time: selectedTimeSlot?.time || '',
        estimated_hours: 1,
        notes: ''
      })

      // Notify parent component to refresh data
      if (onTaskLogCreated) {
        onTaskLogCreated()
      }

      onClose()
    } catch (error) {
      console.error('Error creating task log:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            Add Task Log
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-neutral-600">
            Create a task log for {format(selectedDate, 'MMMM d, yyyy')}
          </p>
        </div>

        <form onSubmit={handleCreateTaskLog} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Task
            </label>
            <select
              value={newTaskLog.task_id}
              onChange={e => setNewTaskLog({ ...newTaskLog, task_id: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Select a task...</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} ({task.estimated_hours}h)
                  {task.projects?.name && ` - ${task.projects.name}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Start Time
            </label>
            <input
              type="time"
              value={newTaskLog.scheduled_start_time}
              onChange={e => setNewTaskLog({ ...newTaskLog, scheduled_start_time: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Duration (hours)
            </label>
            <input
              type="number"
              min="0.25"
              max="8"
              step="0.25"
              value={newTaskLog.estimated_hours}
              onChange={e => setNewTaskLog({ ...newTaskLog, estimated_hours: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={newTaskLog.notes}
              onChange={e => setNewTaskLog({ ...newTaskLog, notes: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Add any notes about this task log..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-neutral-600 text-sm hover:text-neutral-800"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:bg-neutral-300"
              disabled={loading || !newTaskLog.task_id || !newTaskLog.scheduled_start_time}
            >
              {loading ? 'Creating...' : 'Create Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskDailyLogModal