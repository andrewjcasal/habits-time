import { useState } from 'react'
import { Settings, MessageSquare } from 'lucide-react'
import HabitContext from './HabitContext'
import { useHabits } from '../hooks/useHabits'
import { useHabitTypes } from '../hooks/useHabitTypes'

interface HabitDetailTabsProps {
  habitId: string
  habitName: string
  initialContext?: {
    background: string
    benefits: string
    consequences: string
  }
}

const HabitDetailTabs: React.FC<HabitDetailTabsProps> = ({
  habitId,
  habitName,
  initialContext,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('questions')
  const { habits, updateHabitType } = useHabits()
  const { habitTypes } = useHabitTypes()
  
  const currentHabit = habits.find(h => h.id === habitId)
  const currentHabitType = currentHabit?.habits_types

  const tabs = [
    {
      key: 'questions' as const,
      label: 'Questions',
    },
    {
      key: 'settings' as const,
      label: 'Settings',
    },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Context Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{habitName} Context</h2>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex grid grid-cols-2">
          {tabs.map(tab => {
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'bg-white text-blue-700 border-blue-500'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'settings' && (
          <div className="h-full p-4">
            {/* Settings content - placeholder for now */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Habit Name</label>
                <input
                  type="text"
                  value={habitName}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Habit Type
                </label>
                <select
                  value={currentHabit?.habit_type_id || ''}
                  onChange={e => updateHabitType(habitId, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a habit type...</option>
                  {habitTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {currentHabitType && (
                  <p className="text-xs text-gray-600 mt-1">
                    {currentHabitType.description}
                  </p>
                )}
              </div>

            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <HabitContext habitId={habitId} habitName={habitName} initialContext={initialContext} />
        )}
      </div>
    </div>
  )
}

export default HabitDetailTabs
