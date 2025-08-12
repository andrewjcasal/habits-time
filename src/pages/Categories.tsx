import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag, Clock, Users, Calendar, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { useMeetingCategories } from '../hooks/useMeetingCategories'
import { Tabs } from '../components/Tabs'
import { getTimeRangeByPeriod, formatTimeRange } from '../utils/timeRanges'
import { formatHours, getTotalHoursAcrossCategories } from '../utils/meetingHoursCalculation'
import { MeetingCategory, Meeting } from '../types'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table'
import { supabase } from '../lib/supabase'

type TimePeriod = 'thisWeek' | 'lastWeek' | 'last7Days'

const Categories = () => {
  const { categories, meetings, loading, error, getCategoryMeetingData, addCategory, updateCategory, deleteCategory, refetch } = useMeetingCategories()
  const [activeTab, setActiveTab] = useState<TimePeriod>('thisWeek')
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MeetingCategory | null>(null)
  const [expandedUncategorized, setExpandedUncategorized] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6b7280'
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

  const tabs = [
    { id: 'thisWeek', label: 'This Week' },
    { id: 'lastWeek', label: 'Last Week' },
    { id: 'last7Days', label: 'Last 7 Days' },
  ]

  // Get the data for the current time period
  const timeRange = getTimeRangeByPeriod(activeTab)
  const categoryData = getCategoryMeetingData(timeRange)
  const totalHours = getTotalHoursAcrossCategories(categoryData)
  const uncategorizedData = categoryData.find(c => c.id === null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color
        })
      } else {
        await addCategory({
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color
        })
      }

      // Reset form and close modal
      setFormData({ name: '', description: '', color: '#6b7280' })
      setEditingCategory(null)
      setShowModal(false)
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleEdit = (category: MeetingCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color
    })
    setShowModal(true)
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This will remove it from any associated meetings.')) {
      return
    }

    try {
      await deleteCategory(categoryId)
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData({ name: '', description: '', color: '#6b7280' })
  }

  const updateMeetingCategory = async (meetingId: string, categoryId: string | null) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ category_id: categoryId })
        .eq('id', meetingId)

      if (error) throw error

      // Refresh the data to update the UI
      await refetch()
    } catch (error) {
      console.error('Error updating meeting category:', error)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-neutral-500">Loading categories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Tag className="w-5 h-5 text-neutral-600 mr-2" />
            <h1 className="text-lg font-semibold text-neutral-900">Meeting Categories</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </button>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center justify-between text-sm text-neutral-600 mb-4">
          <div className="flex items-center space-x-4">
            <span>Total: {formatHours(totalHours)}</span>
            <span className="text-neutral-300">•</span>
            <span>{formatTimeRange(timeRange)}</span>
          </div>
          <div className="text-xs text-neutral-500">
            {categories.length} categories
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as TimePeriod)} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No categories yet</h3>
            <p className="text-neutral-500 mb-6">Create your first category to organize your meetings</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Category
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Uncategorized Table */}
            {uncategorizedData && uncategorizedData.totalHours > 0 && (
              <div className="bg-white rounded-lg border border-neutral-200">
                <div className="px-4 py-3 border-b border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full bg-neutral-400 flex-shrink-0" />
                      <h3 className="text-sm font-medium text-neutral-900">Uncategorized</h3>
                      <div className="flex items-center text-xs text-neutral-500 space-x-2">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium text-neutral-700">{formatHours(uncategorizedData.totalHours)}</span>
                        <span className="text-neutral-300">•</span>
                        <Users className="w-3 h-3" />
                        <span>{uncategorizedData.meetings.length} meeting{uncategorizedData.meetings.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meeting</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uncategorizedData.meetings.map((meeting) => (
                      <TableRow key={meeting.id}>
                        <TableCell className="font-medium">{meeting.title}</TableCell>
                        <TableCell>
                          <div className="text-xs text-neutral-600">
                            <div>{format(new Date(meeting.start_time), 'MMM d, yyyy')}</div>
                            <div>
                              {format(new Date(meeting.start_time), 'h:mm a')} - 
                              {format(new Date(meeting.end_time), 'h:mm a')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatHours((new Date(meeting.end_time).getTime() - new Date(meeting.start_time).getTime()) / (1000 * 60 * 60))}
                        </TableCell>
                        <TableCell>
                          <select
                            value={meeting.category_id || ''}
                            onChange={(e) => updateMeetingCategory(meeting.id, e.target.value || null)}
                            className="text-xs border border-neutral-300 rounded px-2 py-1 min-w-32"
                          >
                            <option value="">Select category</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Categories Table */}
            <div className="bg-white rounded-lg border border-neutral-200">
              <div className="px-4 py-3 border-b border-neutral-200">
                <h3 className="text-sm font-medium text-neutral-900">Categories</h3>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Meetings</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Categories with meetings */}
                  {categoryData.filter(c => c.id !== null).map((category) => {
                    const originalCategory = categories.find(c => c.id === category.id)
                    return (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-neutral-500">
                          {originalCategory?.description || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatHours(category.totalHours)}
                        </TableCell>
                        <TableCell>
                          {category.meetings.length} meeting{category.meetings.length !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => originalCategory && handleEdit(originalCategory)}
                              className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
                              title="Edit category"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => category.id && handleDelete(category.id)}
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
                  
                  {/* Categories without meetings in this period */}
                  {categories.filter(cat => !categoryData.some(c => c.id === cat.id)).map((category) => (
                    <TableRow key={category.id} className="opacity-50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-neutral-500">
                        {category.description || '-'}
                      </TableCell>
                      <TableCell className="text-neutral-400">0h</TableCell>
                      <TableCell className="text-neutral-400">0 meetings</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
                            title="Edit category"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete category"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={closeModal}
                className="text-neutral-500 hover:text-neutral-700"
              >
                <Plus className="w-3 h-3 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Category name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2 py-1.5 border border-neutral-300 rounded-md text-sm"
                  autoFocus
                  required
                />
              </div>

              <div>
                <textarea
                  placeholder="Description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-2 py-1.5 border border-neutral-300 rounded-md text-sm resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color.value 
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
                  onClick={closeModal}
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