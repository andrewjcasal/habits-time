import { X } from 'lucide-react'

interface CalendarTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  onComplete: () => void
  onDelete: () => void
}

const CalendarTaskModal = ({ isOpen, onClose, task, onComplete, onDelete }: CalendarTaskModalProps) => {
  if (!isOpen || !task) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-3 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900">Task Action</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-3">
          <h3 className="font-medium text-neutral-900 mb-1">{task.title}</h3>
          <p className="text-sm text-neutral-600">
            Project: {task.project?.name || 'Unknown'}
          </p>
          <p className="text-sm text-neutral-600">Estimated: {task.estimated_hours}h</p>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-red-600 hover:text-red-800 text-sm"
          >
            Delete Task
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded text-sm hover:bg-neutral-300"
            >
              Cancel
            </button>
            <button
              onClick={onComplete}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalendarTaskModal