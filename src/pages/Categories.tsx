import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag, Clock, Users, Calendar, Target } from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { useMeetingCategories } from '../hooks/useMeetingCategories'
import { useCategoryBuffers } from '../hooks/useCategoryBuffers'
import { Tabs } from '../components/Tabs'
import { getTimeRangeByPeriod, formatTimeRange } from '../utils/timeRanges'
import { formatHours, getTotalHoursAcrossCategories } from '../utils/meetingHoursCalculation'
import { MeetingCategory } from '../types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { supabase } from '../lib/supabase'

type TabType = 'categories' | 'buffers'

const Categories = () => {
  const {
    categories,
    meetings,
    loading,
    error,
    getCategoryMeetingData,
    addCategory,
    updateCategory,
    deleteCategory,
    refetch,
  } = useMeetingCategories()
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

  const [activeMainTab, setActiveMainTab] = useState<TabType>('categories')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showBufferModal, setShowBufferModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MeetingCategory | null>(null)
  const [editingBuffer, setEditingBuffer] = useState<any>(null)
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#6b7280',
  })
  const [bufferFormData, setBufferFormData] = useState({
    category_id: '',
    weekly_hours: 0,
  })

  const colorOptions = [
    { name: 'Gray', value: '#6b7280' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Yellow', value: '#ca8a04' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Pink', value: '#c2185b' },
  ]

  const mainTabs = [
    { id: 'categories', label: 'Categories' },
    { id: 'buffers', label: 'Buffers' },
  ]

  // Get category data for multiple weeks
  const getWeekData = () => {
    const weeks = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
      const timeRange = { start: weekStart, end: weekEnd }
      const categoryData = getCategoryMeetingData(timeRange)

      weeks.push({
        weekStart,
        weekEnd,
        displayWeek:
          i === 0
            ? 'Current Week'
            : i === 1
            ? `Week of ${format(weekStart, 'MMM d')}`
            : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
        data: categoryData,
      })
    }
    return weeks
  }

  const weeksData = activeMainTab === 'categories' ? getWeekData() : []
  const currentWeekData = weeksData.length > 0 ? weeksData[weeksData.length - 1].data : []
  const totalHours = getTotalHoursAcrossCategories(currentWeekData)
  const uncategorizedData = currentWeekData.find(c => c.id === null)
  const bufferData = getBufferData()

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryFormData)
      } else {
        await addCategory(categoryFormData)
      }
      closeCategoryModal()
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

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

  const handleEditCategory = (category: MeetingCategory) => {
    setEditingCategory(category)
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
    })
    setShowCategoryModal(true)
  }

  const handleEditBuffer = (buffer: any) => {
    setEditingBuffer(buffer)
    setBufferFormData({
      category_id: buffer.category_id,
      weekly_hours: buffer.weekly_hours,
    })
    setShowBufferModal(true)
  }

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await deleteCategory(id)
      } catch (error) {
        console.error('Error deleting category:', error)
      }
    }
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

  const closeCategoryModal = () => {
    setShowCategoryModal(false)
    setEditingCategory(null)
    setCategoryFormData({ name: '', description: '', color: '#6b7280' })
  }

  const closeBufferModal = () => {
    setShowBufferModal(false)
    setEditingBuffer(null)
    setBufferFormData({ category_id: '', weekly_hours: 0 })
  }

  if (loading || buffersLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    )
  }

  if (error || buffersError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {error || buffersError}</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        {/* Main Tabs with Add Button */}
        <div className="flex items-center justify-between mb-4">
          <Tabs
            tabs={mainTabs}
            activeTab={activeMainTab}
            onChange={tab => setActiveMainTab(tab as TabType)}
          />
          <button
            onClick={() =>
              activeMainTab === 'categories' ? setShowCategoryModal(true) : setShowBufferModal(true)
            }
            className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
          >
            {activeMainTab === 'categories' ? 'Add Category' : 'Add Buffer'}
          </button>
        </div>

        {/* Summary Stats (Categories only) */}
        {activeMainTab === 'categories' && (
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <div className="flex items-center space-x-4">
              <span>Current Week Total: {formatHours(totalHours)}</span>
              <span className="text-neutral-300">•</span>
              <span>Last 4 Weeks Overview</span>
            </div>
            <div className="text-xs text-neutral-500">{categories.length} categories</div>
          </div>
        )}

        {/* Buffer Summary */}
        {activeMainTab === 'buffers' && (
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <div className="flex items-center space-x-4">
              <span>Current Week</span>
              <span className="text-neutral-300">•</span>
              <span>
                {format(currentWeekStart, 'MMM d')} -{' '}
                {format(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d')}
              </span>
            </div>
            <div className="text-xs text-neutral-500">{bufferData.length} buffers</div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeMainTab === 'categories' ? (
          // Categories Content
          categories.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No categories yet</h3>
              <p className="text-neutral-500 mb-6">
                Create your first category to organize your meetings
              </p>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Category
              </button>
            </div>
          ) : (
            <div className="bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    {weeksData.map((week, index) => (
                      <TableHead key={index} className="text-center min-w-[120px]">
                        {week.displayWeek}
                      </TableHead>
                    ))}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(category => {
                    return (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </TableCell>
                        {weeksData.map((week, weekIndex) => {
                          const weekCategoryData = week.data.find(cat => cat.id === category.id)
                          const hours = weekCategoryData?.totalHours || 0
                          const meetingCount = weekCategoryData?.meetings.length || 0

                          return (
                            <TableCell key={weekIndex} className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="font-medium text-sm">{formatHours(hours)}</div>
                                <div className="text-xs text-neutral-500">
                                  {meetingCount} meeting{meetingCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </TableCell>
                          )
                        })}
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleEditCategory(category)}
                              className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
                              title="Edit category"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete category"
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
          )
        ) : // Buffers Content
        bufferData.length === 0 ? (
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
          <div className="bg-white border border-neutral-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Weekly Hours</TableHead>
                  <TableHead>Hours Spent</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bufferData.map(buffer => {
                  const util = buffer.utilization
                  return (
                    <TableRow key={buffer.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: util.category_color }}
                          />
                          <span className="font-medium">{util.category_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{buffer.weekly_hours}h</TableCell>
                      <TableCell>{util.hours_spent.toFixed(1)}h</TableCell>
                      <TableCell>{util.hours_remaining.toFixed(1)}h</TableCell>
                      <TableCell>
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
                      <TableCell>
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

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={closeCategoryModal}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <Plus className="w-3 h-3 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Name</label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Category name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={e =>
                    setCategoryFormData({ ...categoryFormData, description: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() =>
                        setCategoryFormData({ ...categoryFormData, color: color.value })
                      }
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        categoryFormData.color === color.value
                          ? 'border-neutral-400 scale-110'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={closeCategoryModal}
                  className="px-3 py-1.5 text-neutral-600 text-sm hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    .filter(
                      cat =>
                        !bufferData.some(
                          buf =>
                            buf.category_id === cat.id ||
                            (editingBuffer && buf.id !== editingBuffer.id)
                        )
                    )
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

export default Categories