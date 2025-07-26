import { useState } from 'react'
import { Settings, MessageSquare, Trash2 } from 'lucide-react'
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
  onHabitDeleted?: () => void
}

const HabitDetailTabs: React.FC<HabitDetailTabsProps> = ({
  habitId,
  habitName,
  initialContext,
  onHabitDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('questions')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { habits, updateHabitType, updateHabitDuration, deleteHabit } = useHabits()
  const { habitTypes } = useHabitTypes()
  
  const currentHabit = habits.find(h => h.id === habitId)
  const currentHabitType = currentHabit?.habits_types

  const handleDeleteHabit = async () => {
    try {
      await deleteHabit(habitId)
      setShowDeleteConfirm(false)
      onHabitDeleted?.()
    } catch (error) {
      console.error('Error deleting habit:', error)
    }
  }

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={currentHabit?.duration || 0}
                  onChange={e => updateHabitDuration(habitId, parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter duration in minutes"
                  min="0"
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

              {/* Delete Habit Section */}
              <div className="pt-6 border-t border-gray-200">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-red-700">Danger Zone</h4>
                  <p className="text-xs text-gray-600">
                    Once you delete a habit, there is no going back. This will hide the habit and all its data.
                  </p>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Habit
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-red-800 font-medium">
                        Are you sure you want to delete "{habitName}"?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteHabit}
                          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
