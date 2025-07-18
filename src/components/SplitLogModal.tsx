import React from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'

interface TimeLog {
  id: string
  activity_types: {
    id: string
    name: string
    is_favorite?: boolean
  }
  start_time: string
  end_time: string | null
  duration?: number
  categories?: Array<{
    id: string
    name: string
    color: string
    is_favorite?: boolean
  }>
}

interface SplitLogModalProps {
  splitModalLog: TimeLog | null
  setSplitModalLog: (log: TimeLog | null) => void
  splitTime: string
  setSplitTime: (time: string) => void
  splitting: string | null
  splitTimeLog: () => void
  formatTime: (timeString: string) => string
  formatDuration: (milliseconds: number) => string
}

const SplitLogModal: React.FC<SplitLogModalProps> = ({
  splitModalLog,
  setSplitModalLog,
  splitTime,
  setSplitTime,
  splitting,
  splitTimeLog,
  formatTime,
  formatDuration,
}) => {
  if (!splitModalLog) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-4"
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">Split Time Log</h3>
          <div className="p-3 bg-neutral-50 rounded-lg">
            <div className="font-medium text-neutral-900">{splitModalLog.activity_types?.name}</div>
            <div className="text-sm text-neutral-600 mt-1">
              {formatTime(splitModalLog.start_time)} →{' '}
              {splitModalLog.end_time && formatTime(splitModalLog.end_time)}
              {splitModalLog.duration && (
                <span className="ml-2 font-medium">({formatDuration(splitModalLog.duration)})</span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">Split at time:</label>
          <input
            type="time"
            value={splitTime}
            onChange={e => setSplitTime(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            min={format(new Date(splitModalLog.start_time), 'HH:mm')}
            max={
              splitModalLog.end_time ? format(new Date(splitModalLog.end_time), 'HH:mm') : undefined
            }
          />
          <div className="text-xs text-neutral-500 mt-1">
            {splitModalLog.end_time ? (
              <>
                Choose a time between {formatTime(splitModalLog.start_time)} and{' '}
                {formatTime(splitModalLog.end_time)}
              </>
            ) : (
              <>Choose a time after {formatTime(splitModalLog.start_time)} (log is in progress)</>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => {
              setSplitModalLog(null)
              setSplitTime('')
            }}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
            disabled={splitting === splitModalLog.id}
          >
            Cancel
          </button>
          <button
            onClick={splitTimeLog}
            disabled={splitting === splitModalLog.id || !splitTime}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 rounded-lg transition-colors"
          >
            {splitting === splitModalLog.id ? 'Splitting...' : 'Split Log'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default SplitLogModal
