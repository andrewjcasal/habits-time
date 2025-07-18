import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Session } from '../types'

interface EditableSessionRowProps {
  session: Session & { assignedTasks?: any[] }
  index: number
  activeSessionTab: 'past' | 'upcoming'
  taskDescription: string
  onCopyToClipboard: (index: number) => void
  onUpdateSession: (sessionId: string, updates: Partial<Session>) => Promise<void>
}

const EditableSessionRow = ({
  session,
  index,
  activeSessionTab,
  taskDescription,
  onCopyToClipboard,
  onUpdateSession,
}: EditableSessionRowProps) => {
  const [editingField, setEditingField] = useState<'date' | 'start_time' | 'end_time' | null>(null)
  const [tempEditValue, setTempEditValue] = useState('')

  const handleSessionFieldEdit = async (
    field: 'date' | 'start_time' | 'end_time',
    value: string
  ) => {
    try {
      let updateData: any = {}

      if (field === 'date') {
        updateData.scheduled_date = value
      } else if (field === 'start_time') {
        updateData.actual_start_time = value
      } else if (field === 'end_time') {
        updateData.actual_end_time = value
      }

      await onUpdateSession(session.id, updateData)
      setEditingField(null)
      setTempEditValue('')
    } catch (error) {
      console.error('Error updating session:', error)
    }
  }

  const handleFieldClick = (field: 'date' | 'start_time' | 'end_time', currentValue: string) => {
    setEditingField(field)
    setTempEditValue(currentValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: 'date' | 'start_time' | 'end_time') => {
    if (e.key === 'Enter') {
      handleSessionFieldEdit(field, tempEditValue)
    } else if (e.key === 'Escape') {
      setEditingField(null)
      setTempEditValue('')
    }
  }

  return (
    <div className="py-2 px-1 border-b border-neutral-100 hover:bg-neutral-50 transition-colors group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Editable Date */}
          {editingField === 'date' ? (
            <input
              type="date"
              value={tempEditValue}
              onChange={e => setTempEditValue(e.target.value)}
              onBlur={() => handleSessionFieldEdit('date', tempEditValue)}
              onKeyDown={e => handleKeyDown(e, 'date')}
              className="text-sm text-neutral-900 bg-white border border-primary-500 rounded px-1 py-0.5 focus:outline-none"
              autoFocus
            />
          ) : (
            <div
              className="text-sm text-neutral-900 cursor-pointer hover:bg-neutral-200 px-1 py-0.5 rounded transition-colors"
              onClick={() => handleFieldClick('date', session.scheduled_date)}
              title="Click to edit date"
            >
              {new Date(session.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          )}

          {/* Editable Start/End Times */}
          {session.actual_start_time && session.actual_end_time && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Start Time */}
              {editingField === 'start_time' ? (
                <input
                  type="time"
                  value={tempEditValue}
                  onChange={e => setTempEditValue(e.target.value)}
                  onBlur={() => handleSessionFieldEdit('start_time', tempEditValue)}
                  onKeyDown={e => handleKeyDown(e, 'start_time')}
                  className="text-xs bg-white border border-primary-500 rounded px-1 py-0.5 focus:outline-none w-16"
                  autoFocus
                />
              ) : (
                <span
                  className="cursor-pointer hover:bg-neutral-300 px-1 py-0.5 rounded transition-colors"
                  onClick={() => handleFieldClick('start_time', session.actual_start_time)}
                  title="Click to edit start time"
                >
                  {(() => {
                    const [hours, minutes] = session.actual_start_time.split(':').map(Number)
                    const ampm = hours >= 12 ? 'PM' : 'AM'
                    const hour12 = hours % 12 || 12
                    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`
                  })()}
                </span>
              )}

              <span>-</span>

              {/* End Time */}
              {editingField === 'end_time' ? (
                <input
                  type="time"
                  value={tempEditValue}
                  onChange={e => setTempEditValue(e.target.value)}
                  onBlur={() => handleSessionFieldEdit('end_time', tempEditValue)}
                  onKeyDown={e => handleKeyDown(e, 'end_time')}
                  className="text-xs bg-white border border-primary-500 rounded px-1 py-0.5 focus:outline-none w-16"
                  autoFocus
                />
              ) : (
                <span
                  className="cursor-pointer hover:bg-neutral-300 px-1 py-0.5 rounded transition-colors"
                  onClick={() => handleFieldClick('end_time', session.actual_end_time)}
                  title="Click to edit end time"
                >
                  {(() => {
                    const [hours, minutes] = session.actual_end_time.split(':').map(Number)
                    const ampm = hours >= 12 ? 'PM' : 'AM'
                    const hour12 = hours % 12 || 12
                    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`
                  })()}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">{session.scheduled_hours}h</span>
          {activeSessionTab === 'upcoming' && (
            <button
              onClick={e => {
                e.stopPropagation()
                onCopyToClipboard(index)
              }}
              className="p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded transition-colors"
              title="Copy task list to clipboard"
            >
              <Copy className="w-2 h-2" />
            </button>
          )}
        </div>
      </div>
      {taskDescription && (
        <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2 pl-1">{taskDescription}</div>
      )}
    </div>
  )
}

export default EditableSessionRow
