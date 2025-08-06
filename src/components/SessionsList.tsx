import { useState } from 'react'
import { Clock, X } from 'lucide-react'
import ReadOnlySessionRow from './ReadOnlySessionRow'
import EditSessionModal from './EditSessionModal'
import SectionHeader from './SectionHeader'
import TabButton from './TabButton'
import { Session } from '../types'

interface SessionsListProps {
  activeSessionTab: 'past' | 'upcoming'
  onSetActiveSessionTab: (tab: 'past' | 'upcoming') => void
  onShowNewSessionForm: () => void
  sessionsLoading: boolean
  sessionsToShow: any[]
  onCopyToClipboard: (sessionIndex: number, sessionsToShow: any[]) => void
  onUpdateSession: (sessionId: string, data: any) => Promise<void>
  onCompleteSessionTasks?: (sessionId: string) => Promise<void>
}

const SessionsList = ({
  activeSessionTab,
  onSetActiveSessionTab,
  onShowNewSessionForm,
  sessionsLoading,
  sessionsToShow,
  onCopyToClipboard,
  onUpdateSession,
  onCompleteSessionTasks,
}: SessionsListProps) => {
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [completingSession, setCompletingSession] = useState<Session | null>(null)

  const handleSessionClick = (session: Session) => {
    setEditingSession(session)
  }

  const handleCloseEditModal = () => {
    setEditingSession(null)
  }

  const handleCompleteSession = (session: Session) => {
    setCompletingSession(session)
  }

  const handleCloseCompleteModal = () => {
    setCompletingSession(null)
  }

  return (
    <div className="w-1/2 border-r border-neutral-200 flex flex-col">
      <div className="bg-white">
        <SectionHeader title="Sessions" onAddClick={onShowNewSessionForm} />

        {/* Tabs */}
        <div className="flex border-b border-neutral-200">
          <TabButton
            isActive={activeSessionTab === 'upcoming'}
            onClick={() => onSetActiveSessionTab('upcoming')}
          >
            Upcoming
          </TabButton>
          <TabButton
            isActive={activeSessionTab === 'past'}
            onClick={() => onSetActiveSessionTab('past')}
          >
            Past
          </TabButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-neutral-500 text-sm">Loading sessions...</p>
            </div>
          </div>
        ) : sessionsToShow.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {activeSessionTab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
            </p>
            <p className="text-xs text-neutral-400">
              {activeSessionTab === 'upcoming'
                ? 'Schedule your work sessions'
                : 'Your completed sessions will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {sessionsToShow.map((session, index) => {
              let taskDescription = ''
              
              if (activeSessionTab === 'upcoming' && session.assignedTasks?.length) {
                // For upcoming sessions, show assigned tasks
                taskDescription = session.assignedTasks.map((task: any) => task.title).join(', ')
              } else if (activeSessionTab === 'past' && (session as any).session_tasks?.length) {
                // For past sessions, show completed tasks from session_tasks
                const completedTasks = (session as any).session_tasks
                  .map((st: any) => st.tasks?.title)
                  .filter((title: string) => title) // Filter out any undefined titles
                if (completedTasks.length > 0) {
                  taskDescription = `Completed: ${completedTasks.join(', ')}`
                }
              }

              return (
                <ReadOnlySessionRow
                  key={session.id}
                  session={session}
                  index={index}
                  activeSessionTab={activeSessionTab}
                  taskDescription={taskDescription}
                  onCopyToClipboard={idx => onCopyToClipboard(idx, sessionsToShow)}
                  onSessionClick={handleSessionClick}
                  onCompleteSession={handleCompleteSession}
                />
              )
            })}
          </div>
        )}
      </div>

      {editingSession && (
        <EditSessionModal
          isOpen={!!editingSession}
          onClose={handleCloseEditModal}
          session={editingSession}
          onUpdateSession={onUpdateSession}
        />
      )}

      {/* Complete Session Modal */}
      {completingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Complete Session</h2>
              <button 
                onClick={handleCloseCompleteModal} 
                className="text-neutral-500 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-4">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">
                Session: {new Date(completingSession.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <p className="text-sm text-neutral-600">Duration: {completingSession.scheduled_hours}h</p>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Tasks completed in this session:</h4>
              {completingSession.assignedTasks && completingSession.assignedTasks.length > 0 ? (
                <ul className="space-y-1">
                  {completingSession.assignedTasks.map((task: any, index: number) => (
                    <li key={index} className="text-sm text-neutral-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full flex-shrink-0"></span>
                      {task.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500 italic">No tasks assigned to this session</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCloseCompleteModal}
                className="px-3 py-1 text-sm text-neutral-600 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onCompleteSessionTasks && completingSession) {
                    try {
                      await onCompleteSessionTasks(completingSession.id)
                      handleCloseCompleteModal()
                    } catch (error) {
                      console.error('Error completing session tasks:', error)
                      // Keep modal open on error so user can retry
                    }
                  } else {
                    handleCloseCompleteModal()
                  }
                }}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionsList
