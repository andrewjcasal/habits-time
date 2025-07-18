import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, Star } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

interface ActivityType {
  id: string
  name: string
}

interface Essential {
  id: string
  user_id: string
  activity_type_id: string
  activity_type_name: string
  daily_minutes: number
  created_at: string
  updated_at: string
}

const Essentials = () => {
  const { user } = useAuth()
  const [essentials, setEssentials] = useState<Essential[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newEssential, setNewEssential] = useState({
    activity_type_id: '',
    daily_minutes: 30,
  })
  const [editForm, setEditForm] = useState({
    activity_type_id: '',
    daily_minutes: 30,
  })

  // Fetch essentials and activity types
  useEffect(() => {
    if (user) {
      fetchEssentials()
      fetchActivityTypes()
    }
  }, [user])

  const fetchEssentials = async () => {
    try {
      const { data, error } = await supabase
        .from('essentials')
        .select(
          `
          *,
          activity_types (name)
        `
        )
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedEssentials =
        data?.map(item => ({
          ...item,
          activity_type_name: item.activity_types?.name || 'Unknown',
        })) || []

      setEssentials(formattedEssentials)
    } catch (error) {
      console.error('Error fetching essentials:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActivityTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('habits_activity_types')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name')

      if (error) throw error
      setActivityTypes(data || [])
    } catch (error) {
      console.error('Error fetching activity types:', error)
    }
  }

  const createEssential = async () => {
    if (!newEssential.activity_type_id) return

    // Check if essential already exists for this activity type
    const existingEssential = essentials.find(
      essential => essential.activity_type_id === newEssential.activity_type_id
    )

    if (existingEssential) {
      alert('An essential already exists for this activity type')
      return
    }

    try {
      const { data, error } = await supabase
        .from('essentials')
        .insert({
          user_id: user?.id,
          activity_type_id: newEssential.activity_type_id,
          daily_minutes: newEssential.daily_minutes,
        })
        .select(
          `
          *,
          activity_types (name)
        `
        )
        .single()

      if (error) throw error

      const formattedEssential = {
        ...data,
        activity_type_name: data.activity_types?.name || 'Unknown',
      }

      setEssentials([formattedEssential, ...essentials])
      setNewEssential({ activity_type_id: '', daily_minutes: 30 })
      setShowAddForm(false)
    } catch (error) {
      console.error('Error creating essential:', error)
    }
  }

  const updateEssential = async (id: string) => {
    try {
      const { error } = await supabase
        .from('essentials')
        .update({
          activity_type_id: editForm.activity_type_id,
          daily_minutes: editForm.daily_minutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      // Update local state
      setEssentials(
        essentials.map(essential => {
          if (essential.id === id) {
            const activityType = activityTypes.find(at => at.id === editForm.activity_type_id)
            return {
              ...essential,
              activity_type_id: editForm.activity_type_id,
              activity_type_name: activityType?.name || 'Unknown',
              daily_minutes: editForm.daily_minutes,
            }
          }
          return essential
        })
      )

      setEditingId(null)
    } catch (error) {
      console.error('Error updating essential:', error)
    }
  }

  const deleteEssential = async (id: string) => {
    if (!confirm('Are you sure you want to delete this essential?')) return

    try {
      const { error } = await supabase.from('essentials').delete().eq('id', id)

      if (error) throw error

      setEssentials(essentials.filter(essential => essential.id !== id))
    } catch (error) {
      console.error('Error deleting essential:', error)
    }
  }

  const startEditing = (essential: Essential) => {
    setEditingId(essential.id)
    setEditForm({
      activity_type_id: essential.activity_type_id,
      daily_minutes: essential.daily_minutes,
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
    }
    return `${mins}m`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Star className="w-6 h-6 text-primary-600 mr-3" />
            <h1 className="text-2xl font-bold text-neutral-900">Essentials</h1>
          </div>
          <p className="text-neutral-600">
            Define the most important activities you want to complete each day and set time
            allocations.
          </p>
        </div>

        {/* Add Essential Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Essential
          </button>
        </div>

        {/* Add Essential Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 bg-white rounded-lg border border-neutral-200 p-6"
            >
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Add New Essential</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Activity Type
                  </label>
                  <select
                    value={newEssential.activity_type_id}
                    onChange={e =>
                      setNewEssential({
                        ...newEssential,
                        activity_type_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select activity type...</option>
                    {activityTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Daily Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newEssential.daily_minutes}
                    onChange={e =>
                      setNewEssential({
                        ...newEssential,
                        daily_minutes: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createEssential}
                  disabled={!newEssential.activity_type_id}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-neutral-300"
                >
                  Add Essential
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Essentials List */}
        <div className="space-y-4">
          {essentials.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
              <Star className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">No essentials yet</h3>
              <p className="text-neutral-600 mb-4">Add your first essential to get started.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Essential
              </button>
            </div>
          ) : (
            essentials.map(essential => (
              <div key={essential.id} className="bg-white rounded-lg border border-neutral-200 p-6">
                {editingId === essential.id ? (
                  // Edit Form
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Activity Type
                      </label>
                      <select
                        value={editForm.activity_type_id}
                        onChange={e =>
                          setEditForm({
                            ...editForm,
                            activity_type_id: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {activityTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Daily Time (minutes)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.daily_minutes}
                        onChange={e =>
                          setEditForm({
                            ...editForm,
                            daily_minutes: parseInt(e.target.value) || 30,
                          })
                        }
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end gap-3">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-neutral-600 border border-neutral-300 rounded-lg hover:bg-neutral-50"
                      >
                        <X className="w-4 h-4 mr-2 inline" />
                        Cancel
                      </button>
                      <button
                        onClick={() => updateEssential(essential.id)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <Save className="w-4 h-4 mr-2 inline" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display View
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">
                        {essential.activity_type_name}
                      </h3>
                      <p className="text-neutral-600">
                        Daily goal: {formatDuration(essential.daily_minutes)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(essential)}
                        className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEssential(essential.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Essentials
