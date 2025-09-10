import React, { useState } from 'react'
import { format } from 'date-fns'
import { MapPin, X, FileText } from 'lucide-react'
import { CalendarNote } from '../types'

interface CalendarNotePinProps {
  note: CalendarNote
  style?: React.CSSProperties
  onRemove?: (noteId: string) => void
}

const CalendarNotePin: React.FC<CalendarNotePinProps> = ({
  note,
  style,
  onRemove,
}) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRemove) {
      onRemove(note.id)
    }
    setShowRemoveConfirm(false)
  }

  const pinnedTime = format(new Date(note.pinned_date), 'HH:mm')

  return (
    <div
      data-calendar-event
      className="absolute z-30 cursor-pointer"
      style={{
        ...style,
        width: '16px',
        height: '16px',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => {
        setShowTooltip(false)
        setShowRemoveConfirm(false)
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <MapPin className="w-4 h-4 text-red-600 drop-shadow-sm" fill="currentColor" />
        
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 text-xs whitespace-nowrap z-50 min-w-48">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <FileText className="w-3 h-3 text-neutral-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-neutral-900 mb-1">
                    {pinnedTime}
                  </div>
                  <div className="text-neutral-700 break-words">
                    {note.habits_notes?.content || 'Note content unavailable'}
                  </div>
                  {note.habits_notes?.note_date && (
                    <div className="text-neutral-500 mt-1">
                      Created: {format(new Date(note.habits_notes.note_date), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              </div>
              {onRemove && (
                <button
                  onClick={handleRemove}
                  className="flex-shrink-0 p-0.5 hover:bg-red-50 rounded transition-colors text-red-600"
                  title="Remove pin"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white border-b border-r border-neutral-200 rotate-45"></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CalendarNotePin