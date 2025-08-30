import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag, Clock, Users, Calendar, Target } from 'lucide-react'
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { useMeetingCategories } from '../hooks/useMeetingCategories'
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

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MeetingCategory | null>(null)
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    color: '#6b7280',
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

  const weeksData = getWeekData()
  const currentWeekData = weeksData.length > 0 ? weeksData[weeksData.length - 1].data : []
  const totalHours = getTotalHoursAcrossCategories(currentWeekData)
  const uncategorizedData = currentWeekData.find(c => c.id === null)

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

  const handleEditCategory = (category: MeetingCategory) => {
    setEditingCategory(category)
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
    })
    setShowCategoryModal(true)
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

  const closeCategoryModal = () => {
    setShowCategoryModal(false)
    setEditingCategory(null)
    setCategoryFormData({ name: '', description: '', color: '#6b7280' })
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4 text-sm text-neutral-600">
            <span>Current Week: {formatHours(totalHours)}</span>
            <span className="text-neutral-300">•</span>
            <span>Last 4 Weeks</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-xs text-neutral-500">{categories.length} categories</div>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 transition-colors"
            >
              Add Category
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
          {categories.length === 0 ? (
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
                  <TableRow className="h-6">
                    <TableHead className="h-6 py-0">Category</TableHead>
                    {weeksData.map((week, index) => (
                      <TableHead key={index} className="text-center min-w-[120px] h-6 py-0">
                        {week.displayWeek}
                      </TableHead>
                    ))}
                    <TableHead className="h-6 py-0">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(category => {
                    return (
                      <TableRow key={category.id} className="h-6">
                        <TableCell className="py-0">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-1 h-1 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </TableCell>
                        {weeksData.map((week, weekIndex) => {
                          const weekCategoryData = week.data.find(cat => cat.id === category.id)
                          const hours = weekCategoryData?.totalHours || 0

                          return (
                            <TableCell key={weekIndex} className="text-center py-0">
                              <div className="font-medium text-sm">{formatHours(hours)}</div>
                            </TableCell>
                          )
                        })}
                        <TableCell className="py-0">
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
        }
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

    </div>
  )
}

export default Categories