import { Copy, Check } from 'lucide-react'
import { Session } from '../types'

interface ReadOnlySessionRowProps {
  session: Session & { assignedTasks?: any[] }
  index: number
  activeSessionTab: 'past' | 'upcoming'
  taskDescription: string
  onCopyToClipboard: (index: number) => void
  onSessionClick: (session: Session) => void
  onCompleteSession?: (session: Session) => void
}

const ReadOnlySessionRow = ({
  session,
  index,
  activeSessionTab,
  taskDescription,
  onCopyToClipboard,
  onSessionClick,
  onCompleteSession,
}: ReadOnlySessionRowProps) => {
  return (
    <div 
      className="py-2 px-1 border-b border-neutral-100 hover:bg-neutral-50 transition-colors group cursor-pointer"
      onClick={() => onSessionClick(session)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm text-neutral-900">
            {new Date(session.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </div>

          {session.actual_start_time && session.actual_end_time && (
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <span>
                {(() => {
                  const [hours, minutes] = session.actual_start_time.split(':').map(Number)
                  const ampm = hours >= 12 ? 'PM' : 'AM'
                  const hour12 = hours % 12 || 12
                  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`
                })()}
              </span>

              <span>-</span>

              <span>
                {(() => {
                  const [hours, minutes] = session.actual_end_time.split(':').map(Number)
                  const ampm = hours >= 12 ? 'PM' : 'AM'
                  const hour12 = hours % 12 || 12
                  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`
                })()}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Complete session check mark - show on hover for today's sessions */}
          {(() => {
            const today = new Date().toISOString().split('T')[0]
            const sessionDate = session.scheduled_date
            return sessionDate === today && onCompleteSession
          })() && (
            <button
              onClick={e => {
                e.stopPropagation()
                onCompleteSession(session)
              }}
              className="p-0.5 text-neutral-400 hover:text-green-600 hover:bg-green-100 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Complete session"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
          
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
        <div className="text-xs text-neutral-600 mt-0.5 line-clamp-2">{taskDescription}</div>
      )}
    </div>
  )
}

export default ReadOnlySessionRow