import { Calendar } from 'lucide-react'
import ModalWrapper from './ModalWrapper'
import SidebarActionButton from './SidebarActionButton'

interface CalendarTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  onComplete: () => void
  onDelete: () => void
  onAddMeeting?: () => void
}

const CalendarTaskModal = ({
  isOpen,
  onClose,
  task,
  onComplete,
  onDelete,
  onAddMeeting,
}: CalendarTaskModalProps) => {
  if (!isOpen || !task) return null

  const rightSidebarActions = onAddMeeting ? (
    <SidebarActionButton
      onClick={onAddMeeting}
      title="Add Meeting"
    >
      <Calendar className="w-3 h-3" />
    </SidebarActionButton>
  ) : undefined

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Task Action"
      rightSidebarActions={rightSidebarActions}
      maxWidth={onAddMeeting ? 'lg' : 'md'}
    >
      <div className="mb-3">
        <h3 className="font-medium text-neutral-900 mb-1">{task.title}</h3>
        <p className="text-sm text-neutral-600">Project: {task.project?.name || 'Unknown'}</p>
        <p className="text-sm text-neutral-600">Estimated: {task.estimated_hours}h</p>
      </div>

      <div className="flex justify-between items-center">
        <button onClick={onDelete} className="px-3 py-1.5 text-red-600 hover:text-red-800 text-sm">
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
    </ModalWrapper>
  )
}

export default CalendarTaskModal
