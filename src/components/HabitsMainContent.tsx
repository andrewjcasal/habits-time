import { ChevronLeft, ChevronRight, Plus, Info } from 'lucide-react'
import HabitsList from './HabitsList'
import HabitDetailTabs from './HabitDetailTabs'
import CreateHabitModal from './CreateHabitModal'

interface HabitsMainContentProps {
  habits: any[]
  loading: boolean
  selectedDate: string
  selectedHabitId: string | null
  showCreateModal: boolean
  initialDetailTab?: 'notes' | 'subhabits' | 'settings'
  onHabitSelect: (habitId: string | null) => void
  onToggleCompletion: (habitId: string) => void
  onUpdateTime: (habitId: string, time: string) => void
  onUpdateCompletedTime: (habitId: string, time: string) => void
  onNavigateDate: (direction: 'prev' | 'next') => void
  onShowCreateModal: (show: boolean) => void
  onCreateHabit: (habitData: any) => void
  formatDateDisplay: (date: string) => string
  getHabitScheduleDisplay: (habit: any, dailyLog: any) => { label: string; time: string }
  formatTime: (time: string) => string
}

const HabitsMainContent = ({
  habits,
  loading,
  selectedDate,
  selectedHabitId,
  showCreateModal,
  initialDetailTab = 'notes',
  onHabitSelect,
  onToggleCompletion,
  onUpdateTime,
  onUpdateCompletedTime,
  onNavigateDate,
  onShowCreateModal,
  onCreateHabit,
  formatDateDisplay,
  getHabitScheduleDisplay,
  formatTime,
}: HabitsMainContentProps) => {
  const selectedHabit = selectedHabitId ? habits.find(h => h.id === selectedHabitId) : null

  return (
    <>
      {/* Info Banner - show when no habits exist */}
      {habits.length === 0 && !loading && (
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-purple-500" />
            <div>
              <h3 className="text-sm font-medium text-purple-900 mb-1">
                Start building better habits!
              </h3>
              <p className="text-sm text-purple-700 leading-relaxed">
                Adding a habit will allow you to create contexts for yourself on why they're
                important. Once you complete a habit, you'll start seeing daily reflections.
                You'll also see them in your calendar too!
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0"
        style={{ minHeight: 'calc(100vh - 200px)' }}
      >
        {/* Habits List - Outlook style */}
        <div className="border-r border-gray-200 flex flex-col">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => onNavigateDate('prev')}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <h2 className="text-sm font-semibold text-gray-900">
                {formatDateDisplay(selectedDate)}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavigateDate('next')}
                  className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onShowCreateModal(true)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Add new habit"
                >
                  <Plus className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <HabitsList
              habits={habits}
              selectedDate={selectedDate}
              selectedHabitId={selectedHabitId}
              onHabitSelect={onHabitSelect}
              onToggleCompletion={onToggleCompletion}
              onUpdateTime={onUpdateTime}
              onUpdateCompletedTime={onUpdateCompletedTime}
              getHabitScheduleDisplay={getHabitScheduleDisplay}
              formatTime={formatTime}
            />
          </div>
        </div>
        
        {/* Detail Panel - Show only selected habit */}
        <div className="bg-white col-span-2 h-full overflow-hidden">
          {selectedHabit && (
            <HabitDetailTabs
              key={`detail-${selectedHabit.id}`}
              habitId={selectedHabit.id}
              habitName={selectedHabit.name}
              initialTab={initialDetailTab}
              initialContext={{
                background: selectedHabit.background || '',
                benefits: selectedHabit.benefits || '',
                consequences: selectedHabit.consequences || '',
              }}
              onHabitDeleted={() => onHabitSelect(null)}
            />
          )}
        </div>
      </div>

      <CreateHabitModal
        isOpen={showCreateModal}
        onClose={() => onShowCreateModal(false)}
        onCreateHabit={onCreateHabit}
      />
    </>
  )
}

export default HabitsMainContent