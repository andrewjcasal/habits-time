import { Clock } from 'lucide-react'
import EditableSessionRow from './EditableSessionRow'
import SectionHeader from './SectionHeader'
import TabButton from './TabButton'

interface SessionsListProps {
  activeSessionTab: 'past' | 'upcoming'
  onSetActiveSessionTab: (tab: 'past' | 'upcoming') => void
  onShowNewSessionForm: () => void
  sessionsLoading: boolean
  sessionsToShow: any[]
  onCopyToClipboard: (sessionIndex: number, sessionsToShow: any[]) => void
  onUpdateSession: (sessionId: string, data: any) => Promise<void>
}

const SessionsList = ({
  activeSessionTab,
  onSetActiveSessionTab,
  onShowNewSessionForm,
  sessionsLoading,
  sessionsToShow,
  onCopyToClipboard,
  onUpdateSession,
}: SessionsListProps) => {
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
              const taskDescription =
                activeSessionTab === 'upcoming' && session.assignedTasks?.length
                  ? session.assignedTasks.map((task: any) => task.title).join(', ')
                  : ''

              return (
                <EditableSessionRow
                  key={session.id}
                  session={session}
                  index={index}
                  activeSessionTab={activeSessionTab}
                  taskDescription={taskDescription}
                  onCopyToClipboard={idx => onCopyToClipboard(idx, sessionsToShow)}
                  onUpdateSession={onUpdateSession}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionsList
