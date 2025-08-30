import { useState } from 'react'
import { Plus, Edit2, Trash2, Target } from 'lucide-react'
import { format, startOfWeek } from 'date-fns'
import { useMeetingCategories } from '../hooks/useMeetingCategories'
import { useCategoryBuffers } from '../hooks/useCategoryBuffers'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const Buffers = () => {
  const { categories } = useMeetingCategories()
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const {
    buffers,
    utilization,
    loading: buffersLoading,
    error: buffersError,
    addBuffer,
    updateBuffer,
    deleteBuffer,
    getBufferData,
    refetch: refetchBuffers,
  } = useCategoryBuffers(currentWeekStart)

  const [showBufferModal, setShowBufferModal] = useState(false)
  const [editingBuffer, setEditingBuffer] = useState<any>(null)
  const [bufferFormData, setBufferFormData] = useState({
    category_id: '',
    weekly_hours: 0,
  })

  const bufferData = getBufferData()

  const handleBufferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingBuffer) {
        await updateBuffer(editingBuffer.id, bufferFormData.weekly_hours)
      } else {
        await addBuffer(bufferFormData.category_id, bufferFormData.weekly_hours)
      }
      closeBufferModal()
    } catch (error) {
      console.error('Error saving buffer:', error)
    }
  }

  const handleEditBuffer = (buffer: any) => {
    setEditingBuffer(buffer)
    setBufferFormData({
      category_id: buffer.category_id,
      weekly_hours: buffer.weekly_hours,
    })
    setShowBufferModal(true)
  }

  const handleDeleteBuffer = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this buffer?')) {
      try {
        await deleteBuffer(id)
      } catch (error) {
        console.error('Error deleting buffer:', error)
      }
    }
  }

  const closeBufferModal = () => {
    setShowBufferModal(false)
    setEditingBuffer(null)
    setBufferFormData({ category_id: '', weekly_hours: 0 })
  }

  if (buffersLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-500">Loading...</div>
      </div>
    )
  }

  if (buffersError) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-red-500">Error: {buffersError}</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4 text-sm text-neutral-600">
            <h1 className="text-lg font-semibold text-neutral-900">Buffers</h1>
            <span>{format(currentWeekStart, 'MMM d')} - {format(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d')}</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-xs text-neutral-500">{bufferData.length} buffers</div>
            <button
              onClick={() => setShowBufferModal(true)}
              className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 transition-colors"
            >
              Add Buffer
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {bufferData.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No buffers yet</h3>
            <p className="text-neutral-500 mb-6">
              Create time buffers to allocate weekly hours to categories
            </p>
            <button
              onClick={() => setShowBufferModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Buffer
            </button>
          </div>
        ) : (
          <div className="bg-white">
            <Table>
              <TableHeader>
                <TableRow className="h-6">
                  <TableHead className="h-6 py-0">Category</TableHead>
                  <TableHead className="h-6 py-0">Weekly Hours</TableHead>
                  <TableHead className="h-6 py-0">Hours Spent</TableHead>
                  <TableHead className="h-6 py-0">Remaining</TableHead>
                  <TableHead className="h-6 py-0">Utilization</TableHead>
                  <TableHead className="h-6 py-0">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bufferData.map(buffer => {
                  const util = buffer.utilization
                  return (
                    <TableRow key={buffer.id} className="h-6">
                      <TableCell className="py-0">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-1 h-1 rounded-full flex-shrink-0"
                            style={{ backgroundColor: util.category_color }}
                          />
                          <span className="font-medium">{util.category_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-0">{buffer.weekly_hours}h</TableCell>
                      <TableCell className="py-0">{util.hours_spent.toFixed(1)}h</TableCell>
                      <TableCell className="py-0">{util.hours_remaining.toFixed(1)}h</TableCell>
                      <TableCell className="py-0">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-neutral-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(100, util.utilization_percentage)}%` }}
                            />
                          </div>
                          <span className="text-xs text-neutral-500">
                            {util.utilization_percentage.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-0">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEditBuffer(buffer)}
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
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Buffer Modal */}
      {showBufferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {editingBuffer ? 'Edit Buffer' : 'Add Buffer'}
              </h2>
              <button
                onClick={closeBufferModal}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <Plus className="w-3 h-3 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleBufferSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                <select
                  value={bufferFormData.category_id}
                  onChange={e =>
                    setBufferFormData({ ...bufferFormData, category_id: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  required
                  disabled={!!editingBuffer}
                >
                  <option value="">Select a category</option>
                  {categories
                    .filter(cat => {
                      if (editingBuffer) {
                        return !bufferData.some(buf => buf.category_id === cat.id && buf.id !== editingBuffer.id)
                      }
                      return !bufferData.some(buf => buf.category_id === cat.id)
                    })
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Weekly Hours
                </label>
                <input
                  type="number"
                  value={bufferFormData.weekly_hours}
                  onChange={e =>
                    setBufferFormData({
                      ...bufferFormData,
                      weekly_hours: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., 10.5"
                  min="0.5"
                  max="168"
                  step="0.5"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">
                  How many hours per week to allocate to this category
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={closeBufferModal}
                  className="px-3 py-1.5 text-neutral-600 text-sm hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  {editingBuffer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Buffers