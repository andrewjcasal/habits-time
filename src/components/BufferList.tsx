import { useState } from 'react'
import { Plus, Edit2, Trash2, Target } from 'lucide-react'
import { format, startOfWeek } from 'date-fns'
import { useCategoryBuffers } from '../hooks/useCategoryBuffers'
import { useMeetingCategories } from '../hooks/useMeetingCategories'

interface BufferListProps {
  onShowBufferModal: () => void
  onEditBuffer: (buffer: any) => void
  onDeleteBuffer: (id: string) => Promise<void>
}

export const BufferList = ({ onShowBufferModal, onEditBuffer, onDeleteBuffer }: BufferListProps) => {
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const { categories } = useMeetingCategories()
  const {
    buffers,
    getBufferData,
  } = useCategoryBuffers(currentWeekStart)

  const bufferData = getBufferData()

  const handleDeleteBuffer = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this buffer?')) {
      try {
        await onDeleteBuffer(id)
      } catch (error) {
        console.error('Error deleting buffer:', error)
      }
    }
  }

  return (
    <div className="p-2">
      <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Buffers</h2>
      {bufferData.length === 0 ? (
        <div className="text-center py-8">
          <Target className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-xs text-neutral-500 mb-3">No buffers yet</p>
          <button
            onClick={onShowBufferModal}
            className="inline-flex items-center px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Buffer
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {bufferData.map(buffer => {
            const util = buffer.utilization
            return (
              <div key={buffer.id} className="p-2 rounded hover:bg-neutral-50 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: util.category_color }}
                    />
                    <span className="text-xs font-medium">{util.category_name}</span>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditBuffer(buffer)}
                      className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
                      title="Edit buffer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteBuffer(buffer.id)}
                      className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete buffer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {util.hours_spent.toFixed(1)}h / {buffer.weekly_hours}h
                </div>
                <div className="mt-1">
                  <div className="w-full bg-neutral-200 rounded-full h-1">
                    <div
                      className="bg-primary-600 h-1 rounded-full transition-all"
                      style={{ width: `${Math.min(100, util.utilization_percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
          <button
            onClick={onShowBufferModal}
            className="w-full mt-2 p-2 border border-dashed border-neutral-300 rounded text-xs text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 transition-colors"
          >
            + Add Buffer
          </button>
        </div>
      )}
    </div>
  )
}