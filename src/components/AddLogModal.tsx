import React from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'

interface ActivityType {
  id: string
  name: string
  is_favorite?: boolean
}

interface AddLogModalProps {
  showAddLogModal: boolean
  closeAddLogModal: () => void
  selectedDate: Date
  newLogActivityType: string
  setNewLogActivityType: (value: string) => void
  newLogStartTime: string
  setNewLogStartTime: (value: string) => void
  newLogEndTime: string
  setNewLogEndTime: (value: string) => void
  newLogIsInProgress: boolean
  setNewLogIsInProgress: (value: boolean) => void
  creatingLog: boolean
  createNewLog: () => void
  activityTypes: ActivityType[]
}

const AddLogModal: React.FC<AddLogModalProps> = ({
  showAddLogModal,
  closeAddLogModal,
  selectedDate,
  newLogActivityType,
  setNewLogActivityType,
  newLogStartTime,
  setNewLogStartTime,
  newLogEndTime,
  setNewLogEndTime,
  newLogIsInProgress,
  setNewLogIsInProgress,
  creatingLog,
  createNewLog,
  activityTypes,
}) => {
  if (!showAddLogModal) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-4"
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">Add New Time Log</h3>
          <p className="text-sm text-neutral-600">
            Create a new time log for {format(selectedDate, 'MMMM d, yyyy')}
          </p>
        </div>

        <div className="space-y-4">
          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Activity Type</label>
            <input
              type="text"
              value={newLogActivityType}
              onChange={e => setNewLogActivityType(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter activity name..."
              list="activity-types"
            />
            <datalist id="activity-types">
              {activityTypes.map(type => (
                <option key={type.id} value={type.name} />
              ))}
            </datalist>
            <div className="text-xs text-neutral-500 mt-1">
              Type an existing activity or create a new one
            </div>
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Start Time</label>
            <input
              type="time"
              value={newLogStartTime}
              onChange={e => setNewLogStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* In Progress Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="in-progress"
              checked={newLogIsInProgress}
              onChange={e => setNewLogIsInProgress(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
            />
            <label htmlFor="in-progress" className="ml-2 text-sm text-neutral-700">
              This log is still in progress
            </label>
          </div>

          {/* End Time (only show if not in progress) */}
          {!newLogIsInProgress && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                End Time (optional)
              </label>
              <input
                type="time"
                value={newLogEndTime}
                onChange={e => setNewLogEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div className="text-xs text-neutral-500 mt-1">
                Leave empty to create an in-progress log
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={closeAddLogModal}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
            disabled={creatingLog}
          >
            Cancel
          </button>
          <button
            onClick={createNewLog}
            disabled={creatingLog || !newLogActivityType.trim() || !newLogStartTime}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 rounded-lg transition-colors"
          >
            {creatingLog ? 'Creating...' : 'Create Log'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default AddLogModal
