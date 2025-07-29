import { useState, useEffect } from 'react'
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
  const [unsavedName, setUnsavedName] = useState<string | null>(null)
  const [unsavedStartTime, setUnsavedStartTime] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { habits, updateHabitType, updateHabitDuration, updateHabitName, updateHabitDefaultStartTime, deleteHabit } = useHabits()
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


  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      if (unsavedName !== null && unsavedName.trim() !== habitName) {
        await updateHabitName(habitId, unsavedName.trim())
        setUnsavedName(null)
      }
      if (unsavedStartTime !== null) {
        await updateHabitDefaultStartTime(habitId, unsavedStartTime)
        setUnsavedStartTime(null)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const hasUnsavedChanges = unsavedName !== null || unsavedStartTime !== null

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
      <div className="bg-gray-50 px-2 py-1.5 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-900">{habitName} Context</h2>
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
                className={`flex items-center gap-1 px-2 py-1.5 text-sm font-medium transition-colors border-b-2 ${
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
          <div className="h-full overflow-y-auto p-2">
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Habit Name</label>
                <input
                  type="text"
                  value={unsavedName !== null ? unsavedName : (currentHabit?.name || habitName)}
                  onChange={e => setUnsavedName(e.target.value)}
                  className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${
                    unsavedName !== null && unsavedName !== habitName ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                  }`}
                />
                {unsavedName !== null && unsavedName !== habitName && (
                  <p className="text-xs text-yellow-600 mt-1">Unsaved changes</p>
                )}
              </div>

              {/* Only show duration for calendar habits */}
              {currentHabit?.habits_types?.scheduling_rule !== 'non_calendar' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Duration (minutes)</label>
                  <input
                    type="number"
                    value={currentHabit?.duration || 0}
                    onChange={e => updateHabitDuration(habitId, parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter duration in minutes"
                    min="0"
                  />
                </div>
              )}

              {/* Only show default start time for calendar habits */}
              {currentHabit?.habits_types?.scheduling_rule !== 'non_calendar' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Default Start Time</label>
                  <input
                    type="time"
                    value={unsavedStartTime !== null ? unsavedStartTime : (currentHabit?.default_start_time || '')}
                    onChange={e => setUnsavedStartTime(e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent ${
                      hasUnsavedChanges ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                    }`}
                  />
                  {hasUnsavedChanges && (
                    <p className="text-xs text-yellow-600 mt-1">Unsaved changes</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Habit Type
                </label>
                <select
                  value={currentHabit?.habit_type_id || ''}
                  onChange={e => updateHabitType(habitId, e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a habit type...</option>
                  {habitTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {currentHabitType && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    {currentHabitType.description}
                  </p>
                )}
              </div>

              {/* Save Button */}
              {hasUnsavedChanges && (
                <div className="pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* Delete Habit Section */}
              <div className="pt-2 border-t border-gray-200">
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-red-700">Danger Zone</h4>
                  <p className="text-xs text-gray-600">
                    Once you delete a habit, there is no going back. This will hide the habit and all its data.
                  </p>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete Habit
                    </button>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-red-800 font-medium">
                        Are you sure you want to delete "{habitName}"?
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={handleDeleteHabit}
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-xs"
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
