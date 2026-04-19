import { useEffect, useState } from 'react'
import ModalWrapper from './ModalWrapper'

interface CalendarTaskModalProps {
  isOpen: boolean
  onClose: () => void
  task: any
  onComplete: () => void
  onDelete: () => void
  /**
   * Persist user edits to due date / duration. For Todoist and ClickUp
   * tasks this also pushes the change to the external system so the next
   * sync reads the same values back and doesn't overwrite. Returns when
   * the local DB + upstream write are both done.
   */
  onUpdate?: (
    task: any,
    changes: { dueDate?: string | null; durationMinutes?: number }
  ) => Promise<void>
}

const CalendarTaskModal = ({
  isOpen,
  onClose,
  task,
  onComplete,
  onDelete,
  onUpdate,
}: CalendarTaskModalProps) => {
  // Task-daily-log rows wrap the task under `.tasks`; direct task objects
  // have the fields on the task itself. Normalize so the modal can read
  // either shape.
  const taskRow = task?.tasks || task
  const source = taskRow?.source as string | undefined
  const canEditExternal = source === 'todoist' || source === 'clickup'

  const [dueDate, setDueDate] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (!taskRow) return
    setDueDate(taskRow.due_date ? String(taskRow.due_date).slice(0, 10) : '')
    const hours = taskRow.estimated_hours ?? 0.5
    setDurationMin(Math.round(Number(hours) * 60))
  }, [taskRow?.id])

  if (!isOpen || !task) return null

  const originalDue = taskRow.due_date ? String(taskRow.due_date).slice(0, 10) : ''
  const originalDur = Math.round(Number(taskRow.estimated_hours ?? 0.5) * 60)
  const dirty = dueDate !== originalDue || durationMin !== originalDur

  const handleSave = async () => {
    if (!onUpdate) return
    setSaving(true)
    try {
      await onUpdate(taskRow, {
        dueDate: dueDate || null,
        durationMinutes: durationMin,
      })
      onClose()
    } catch (err) {
      console.error('Error saving task edits:', err)
      setSavedMessage('Error')
      setTimeout(() => setSavedMessage(''), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Task Action" maxWidth="md">
      <div className="mb-3">
        <h3 className="font-medium text-neutral-900 mb-1">{taskRow.title}</h3>
        <p className="text-sm text-neutral-600">
          Project: {taskRow.projects?.name || taskRow.project?.name || 'Unknown'}
        </p>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label htmlFor="task-due-date" className="block text-xs font-medium text-neutral-700 mb-1">
            Due date
          </label>
          <input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full px-2 py-1 border border-neutral-300 rounded-md text-xs"
          />
        </div>
        <div className="w-28">
          <label htmlFor="task-duration" className="block text-xs font-medium text-neutral-700 mb-1">
            Duration (min)
          </label>
          <input
            id="task-duration"
            type="number"
            min={0}
            value={durationMin}
            onChange={e => setDurationMin(parseInt(e.target.value) || 0)}
            className="w-full px-2 py-1 border border-neutral-300 rounded-md text-xs"
          />
        </div>
      </div>

      {!canEditExternal && dirty && (
        <p className="text-[11px] text-neutral-500 mb-2">
          Changes will save locally only — this task has no linked Todoist / ClickUp record.
        </p>
      )}

      <div className="flex justify-between items-center">
        <button onClick={onDelete} className="px-3 py-1.5 text-red-600 hover:text-red-800 text-sm">
          Delete Task
        </button>
        <div className="flex items-center gap-2">
          {savedMessage && (
            <span className={`text-xs ${savedMessage === 'Error' ? 'text-red-600' : 'text-green-600'}`}>
              {savedMessage}
            </span>
          )}
          {onUpdate && dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
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
