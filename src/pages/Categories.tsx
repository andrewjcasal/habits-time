import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Category {
  id: string
  name: string
  description?: string
  color: string
  created_at: string
  updated_at: string
}

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
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

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('meeting_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (error) {
        console.error('Error fetching categories:', error)
        return
      }

      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('meeting_categories')
          .update({
            name: formData.name,
            description: formData.description || null,
            color: formData.color
          })
          .eq('id', editingCategory.id)

        if (error) {
          console.error('Error updating category:', error)
          return
        }
      } else {
        // Create new category
        const { error } = await supabase
          .from('meeting_categories')
          .insert({
            user_id: user.id,
            name: formData.name,
            description: formData.description || null,
            color: formData.color
          })

        if (error) {
          console.error('Error creating category:', error)
          return
        }
      }

      // Reset form and refresh data
      setFormData({ name: '', description: '', color: '#6b7280' })
      setEditingCategory(null)
      setShowModal(false)
      fetchCategories()
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleEdit = (category: Category) => {
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
      const { error } = await supabase
        .from('meeting_categories')
        .delete()
        .eq('id', categoryId)

      if (error) {
        console.error('Error deleting category:', error)
        return
      }

      fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData({ name: '', description: '', color: '#6b7280' })
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-neutral-500">Loading categories...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Tag className="w-5 h-5 text-neutral-600 mr-2" />
            <h1 className="text-lg font-semibold text-neutral-900">Categories</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </button>
        </div>
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
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <h3 className="text-sm font-medium text-neutral-900">{category.name}</h3>
                      {category.description && (
                        <p className="text-xs text-neutral-500 mt-1">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
                      title="Edit category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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