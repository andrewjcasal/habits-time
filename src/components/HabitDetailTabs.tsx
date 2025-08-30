import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, MessageSquare, Trash2, Plus, X, Target, FileText, Edit2, ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import HabitContext from './HabitContext'
import { useHabits } from '../hooks/useHabits'
import { useHabitTypes } from '../hooks/useHabitTypes'
import { supabase } from '../lib/supabase'

interface HabitDetailTabsProps {
  habitId: string
  habitName: string
  initialTab?: 'notes' | 'subhabits' | 'settings'
  initialContext?: {
    background: string
    benefits: string
    consequences: string
  }
  onHabitDeleted?: () => void
  showBackButton?: boolean
  onBackClick?: () => void
  showCompletionToggle?: boolean
  onCompletionToggle?: () => void
  isCompleted?: boolean
}

const HabitDetailTabs: React.FC<HabitDetailTabsProps> = ({
  habitId,
  habitName,
  initialTab = 'notes',
  initialContext,
  onHabitDeleted,
  showBackButton = false,
  onBackClick,
  showCompletionToggle = false,
  onCompletionToggle,
  isCompleted = false,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'subhabits' | 'settings'>(initialTab)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [unsavedName, setUnsavedName] = useState<string | null>(null)
  const [unsavedStartTime, setUnsavedStartTime] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [subhabits, setSubhabits] = useState<any[]>([])
  const [aspects, setAspects] = useState<any[]>([])
  const [newSubhabitTitle, setNewSubhabitTitle] = useState('')
  const [newSubhabitAspectId, setNewSubhabitAspectId] = useState('')
  const [addingSubhabit, setAddingSubhabit] = useState(false)
  const [aspectNotes, setAspectNotes] = useState<any[]>([])
  const [subhabitComments, setSubhabitComments] = useState<{[key: string]: string}>({})
  const [savingComments, setSavingComments] = useState<{[key: string]: boolean}>({})
  const commentTimeoutRefs = useRef<{[key: string]: NodeJS.Timeout}>({})
  const { habits, updateHabitType, updateHabitDuration, updateHabitName, updateHabitDefaultStartTime, deleteHabit } = useHabits()
  const { habitTypes } = useHabitTypes()
  
  const currentHabit = habits.find(h => h.id === habitId)
  const currentHabitType = currentHabit?.habits_types
  const navigate = useNavigate()

  // Fetch subhabits and aspects
  const fetchSubhabits = async () => {
    try {
      const { data, error } = await supabase
        .from('subhabits')
        .select(`
          *,
          aspects (
            id,
            title
          )
        `)
        .eq('habit_id', habitId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setSubhabits(data || [])
    } catch (err) {
      console.error('Error fetching subhabits:', err)
    }
  }

  const fetchAspects = async () => {
    try {
      const { data, error } = await supabase
        .from('aspects')
        .select('*')
        .order('title', { ascending: true })

      if (error) throw error
      setAspects(data || [])
    } catch (err) {
      console.error('Error fetching aspects:', err)
    }
  }

  const fetchAspectNotes = async () => {
    try {
      // First, get the aspect IDs from this habit's subhabits
      const { data: habitSubhabits, error: subhabitsError } = await supabase
        .from('subhabits')
        .select('aspect_id')
        .eq('habit_id', habitId)
        .not('aspect_id', 'is', null)

      if (subhabitsError) throw subhabitsError

      const aspectIds = habitSubhabits?.map(sh => sh.aspect_id).filter(Boolean) || []

      // If no aspects are associated with this habit's subhabits, show no notes
      if (aspectIds.length === 0) {
        setAspectNotes([])
        return
      }

      // Get notes that are connected to these aspects
      const { data: noteAspects, error: noteAspectsError } = await supabase
        .from('note_aspects')
        .select('note_id')
        .in('aspect_id', aspectIds)

      if (noteAspectsError) throw noteAspectsError

      const noteIds = noteAspects?.map(na => na.note_id) || []

      if (noteIds.length === 0) {
        setAspectNotes([])
        return
      }

      // Get the actual notes with their aspect information
      const { data: notes, error: notesError } = await supabase
        .from('habits_notes')
        .select(`
          id,
          title,
          content,
          created_at,
          note_aspects!inner (
            aspects!inner (
              id,
              title
            )
          )
        `)
        .in('id', noteIds)
        .order('created_at', { ascending: false })

      if (notesError) throw notesError

      // Transform the data to include aspect information
      const transformedNotes = notes?.map(note => ({
        ...note,
        aspect_title: note.note_aspects?.[0]?.aspects?.title || 'Unknown'
      })) || []

      setAspectNotes(transformedNotes)
    } catch (err) {
      console.error('Error fetching aspect notes:', err)
      setAspectNotes([])
    }
  }

  // Fetch subhabit comments for today
  const fetchSubhabitComments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('subhabit_comments')
        .select('subhabit_id, comment')
        .eq('comment_date', today)
        .eq('user_id', user.id)
        .in('subhabit_id', subhabits.map(sh => sh.id))

      if (error) throw error

      const commentsMap = data?.reduce((acc: any, comment: any) => {
        acc[comment.subhabit_id] = comment.comment
        return acc
      }, {}) || {}

      setSubhabitComments(commentsMap)
    } catch (err) {
      console.error('Error fetching subhabit comments:', err)
    }
  }

  // Save or update subhabit comment
  const saveSubhabitComment = async (subhabitId: string, comment: string) => {
    setSavingComments(prev => ({ ...prev, [subhabitId]: true }))
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No authenticated user')
        return
      }
      
      const { error } = await supabase
        .from('subhabit_comments')
        .upsert({
          subhabit_id: subhabitId,
          user_id: user.id,
          comment: comment.trim(),
          comment_date: today
        }, {
          onConflict: 'subhabit_id,user_id,comment_date'
        })

      if (error) throw error

      setSubhabitComments(prev => ({
        ...prev,
        [subhabitId]: comment.trim()
      }))
    } catch (err) {
      console.error('Error saving subhabit comment:', err)
    } finally {
      setSavingComments(prev => ({ ...prev, [subhabitId]: false }))
    }
  }

  // Handle comment change with debounced auto-save
  const handleCommentChange = (subhabitId: string, comment: string) => {
    // Update state immediately for UI responsiveness
    setSubhabitComments(prev => ({
      ...prev,
      [subhabitId]: comment
    }))

    // Clear existing timeout for this subhabit
    if (commentTimeoutRefs.current[subhabitId]) {
      clearTimeout(commentTimeoutRefs.current[subhabitId])
    }

    // Set new timeout for autosave
    commentTimeoutRefs.current[subhabitId] = setTimeout(() => {
      if (comment.trim() !== '') {
        saveSubhabitComment(subhabitId, comment)
      }
    }, 1000) // 1 second delay like in notes
  }

  // Add new subhabit
  const handleAddSubhabit = async () => {
    if (!newSubhabitTitle.trim()) return

    try {
      const { data, error } = await supabase
        .from('subhabits')
        .insert({
          habit_id: habitId,
          title: newSubhabitTitle.trim(),
          aspect_id: newSubhabitAspectId || null
        })
        .select(`
          *,
          aspects (
            id,
            title
          )
        `)
        .single()

      if (error) throw error

      setSubhabits(prev => [...prev, data])
      setNewSubhabitTitle('')
      setNewSubhabitAspectId('')
      setAddingSubhabit(false)
    } catch (err) {
      console.error('Error adding subhabit:', err)
    }
  }

  // Delete subhabit
  const handleDeleteSubhabit = async (subhabitId: string) => {
    try {
      const { error } = await supabase
        .from('subhabits')
        .delete()
        .eq('id', subhabitId)

      if (error) throw error
      setSubhabits(prev => prev.filter(s => s.id !== subhabitId))
    } catch (err) {
      console.error('Error deleting subhabit:', err)
    }
  }

  useEffect(() => {
    fetchSubhabits()
    fetchAspects()
    fetchAspectNotes()
  }, [habitId])

  // Fetch comments after subhabits are loaded
  useEffect(() => {
    if (subhabits.length > 0) {
      fetchSubhabitComments()
    }
  }, [subhabits])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(commentTimeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

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
      key: 'notes' as const,
      label: 'Notes',
    },
    {
      key: 'subhabits' as const,
      label: 'Subhabits',
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton && onBackClick && (
              <button
                onClick={onBackClick}
                className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900">{habitName} Context</h2>
          </div>
          {showCompletionToggle && onCompletionToggle && (
            <button
              onClick={onCompletionToggle}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5 text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <div className="flex grid grid-cols-3">
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

        {activeTab === 'notes' && (
          <div className="h-full overflow-y-auto p-2">
            <div className="space-y-4">
              {/* Notes list */}
              {aspectNotes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No related notes found</p>
                  <p className="text-xs opacity-75">Notes will appear here when they're connected to aspects used by this habit's subhabits</p>
                </div>
              ) : (
                (() => {
                  // Group notes by aspect
                  const notesByAspect = aspectNotes.reduce((acc: any, note: any) => {
                    const aspectTitle = note.aspect_title || 'Unknown'
                    if (!acc[aspectTitle]) {
                      acc[aspectTitle] = []
                    }
                    acc[aspectTitle].push(note)
                    return acc
                  }, {})

                  return Object.entries(notesByAspect).map(([aspectTitle, notes]: [string, any]) => (
                    <div key={aspectTitle}>
                      <h3 className="text-xs font-medium text-gray-700 mb-3">Related to {aspectTitle}</h3>
                      <div className="space-y-3 ml-2">
                        {notes.map((note: any) => (
                          <div key={note.id} className="group">
                            <div className="flex items-baseline gap-1 mb-1">
                              {note.created_at && (
                                <span className="text-xs text-gray-400">
                                  {new Date(note.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                              {note.title && (
                                <div className="flex items-center gap-1">
                                  <h4 className="text-sm font-medium text-gray-900">{note.title}</h4>
                                  <button
                                    onClick={() => {
                                      navigate(`/notes?noteId=${note.id}`)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                                    title="Edit note"
                                  >
                                    <Edit2 className="w-2 h-2 text-gray-400 hover:text-gray-600" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed mb-2">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                })()
              )}
            </div>
          </div>
        )}

        {activeTab === 'subhabits' && (
          <div className="h-full overflow-y-auto p-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-700">Subhabits</h3>
                <button
                  onClick={() => setAddingSubhabit(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="w-2 h-2" />
                  Add
                </button>
              </div>

              {/* Add new subhabit form */}
              {addingSubhabit && (
                <div className="p-2 border border-blue-200 rounded bg-blue-50 space-y-2">
                  <input
                    type="text"
                    placeholder="Subhabit title..."
                    value={newSubhabitTitle}
                    onChange={(e) => setNewSubhabitTitle(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <select
                    value={newSubhabitAspectId}
                    onChange={(e) => setNewSubhabitAspectId(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select aspect (optional)...</option>
                    {aspects.map(aspect => (
                      <option key={aspect.id} value={aspect.id}>
                        {aspect.title}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <button
                      onClick={handleAddSubhabit}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingSubhabit(false)
                        setNewSubhabitTitle('')
                        setNewSubhabitAspectId('')
                      }}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Subhabits list */}
              <div className="space-y-1">
                {subhabits.length === 0 ? (
                  <p className="text-xs text-gray-500 py-4 text-center">
                    No subhabits yet. Add one to break down this habit into smaller actions.
                  </p>
                ) : (
                  subhabits.map(subhabit => (
                    <div
                      key={subhabit.id}
                      className="p-2 border border-gray-200 rounded bg-white hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-xs font-medium text-gray-900">
                            {subhabit.title}
                          </div>
                          {subhabit.aspects && (
                            <div className="text-xs text-green-700 mt-0.5">
                              <Target className="w-2 h-2 inline mr-1" />
                              {subhabit.aspects.title}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteSubhabit(subhabit.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Delete subhabit"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </div>
                      
                      {/* Today's comments field */}
                      <div className="w-full">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Today's comments:
                        </label>
                        <textarea
                          value={subhabitComments[subhabit.id] || ''}
                          onChange={(e) => handleCommentChange(subhabit.id, e.target.value)}
                          placeholder="Add your thoughts about this subhabit today..."
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={2}
                        />
                        {savingComments[subhabit.id] && (
                          <div className="text-xs text-gray-500 mt-1">Saving...</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HabitDetailTabs
