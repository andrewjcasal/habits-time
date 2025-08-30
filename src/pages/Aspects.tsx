import { useState, useEffect } from 'react'
import { Plus, X, Target, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

interface Aspect {
  id: string
  title: string
  created_at: string
  updated_at: string
  subhabits?: Subhabit[]
}

interface Subhabit {
  id: string
  title: string
  aspect_id: string
  created_at: string
  updated_at: string
}

const Aspects = () => {
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [loading, setLoading] = useState(true)
  const [newAspectTitle, setNewAspectTitle] = useState('')
  const [addingAspect, setAddingAspect] = useState(false)
  const [selectedAspect, setSelectedAspect] = useState<Aspect | null>(null)
  const [selectedSubhabit, setSelectedSubhabit] = useState<Subhabit | null>(null)
  const [aspectComments, setAspectComments] = useState<any[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  // Fetch aspects with subhabits
  const fetchAspects = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('aspects')
        .select(`
          *,
          subhabits (
            id,
            title,
            aspect_id,
            created_at,
            updated_at
          )
        `)
        .order('title', { ascending: true })

      if (error) throw error
      setAspects(data || [])
    } catch (err) {
      console.error('Error fetching aspects:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch comments for selected subhabit or all subhabits in aspect
  const fetchComments = async (subhabitId?: string, aspectId?: string) => {
    try {
      setCommentsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      let query = supabase
        .from('subhabit_comments')
        .select(`
          id,
          comment,
          comment_date,
          created_at,
          subhabits!inner (
            id,
            title,
            aspect_id
          )
        `)
        .eq('user_id', user.id)

      if (subhabitId) {
        query = query.eq('subhabit_id', subhabitId)
      } else if (aspectId) {
        query = query.eq('subhabits.aspect_id', aspectId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      const comments = data?.map((comment: any) => ({
        id: comment.id,
        comment: comment.comment,
        comment_date: comment.comment_date,
        subhabit_title: comment.subhabits.title,
        created_at: comment.created_at
      })) || []

      setAspectComments(comments)
    } catch (err) {
      console.error('Error fetching comments:', err)
    } finally {
      setCommentsLoading(false)
    }
  }

  // Add new aspect
  const handleAddAspect = async () => {
    if (!newAspectTitle.trim()) return

    try {
      const { data, error } = await supabase
        .from('aspects')
        .insert({
          title: newAspectTitle.trim()
        })
        .select()
        .single()

      if (error) throw error

      setAspects(prev => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)))
      setNewAspectTitle('')
      setAddingAspect(false)
    } catch (err) {
      console.error('Error adding aspect:', err)
    }
  }

  // Handle aspect selection
  const handleAspectSelect = (aspect: Aspect) => {
    setSelectedAspect(aspect)
    setSelectedSubhabit(null)
    fetchComments(undefined, aspect.id)
  }

  // Handle subhabit selection
  const handleSubhabitSelect = (subhabit: Subhabit) => {
    setSelectedSubhabit(subhabit)
    fetchComments(subhabit.id)
  }

  useEffect(() => {
    fetchAspects()
  }, [])

  // Auto-select first aspect when aspects load
  useEffect(() => {
    if (aspects.length > 0 && !selectedAspect) {
      handleAspectSelect(aspects[0])
    }
  }, [aspects, selectedAspect])

  if (loading) {
    return <LoadingSpinner message="Loading aspects..." />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Navigation */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold text-gray-900">Aspects</h1>
            <button
              onClick={() => setAddingAspect(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Organize your habits and notes by life aspects
          </p>
        </div>

        {/* Add new aspect form */}
        {addingAspect && (
          <div className="p-3 border-b border-gray-200 bg-blue-50 space-y-2">
            <input
              type="text"
              placeholder="Aspect title..."
              value={newAspectTitle}
              onChange={(e) => setNewAspectTitle(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddAspect()
                if (e.key === 'Escape') {
                  setAddingAspect(false)
                  setNewAspectTitle('')
                }
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleAddAspect}
                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddingAspect(false)
                  setNewAspectTitle('')
                }}
                className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Aspects List */}
        <div className="flex-1 overflow-y-auto">
          {aspects.length === 0 ? (
            <div className="p-4 text-center">
              <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No aspects yet. Add your first aspect to start.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {aspects.map(aspect => (
                <div key={aspect.id} className="space-y-1">
                  {/* Aspect Button */}
                  <button
                    onClick={() => handleAspectSelect(aspect)}
                    className={`w-full text-left p-2 rounded text-sm hover:bg-gray-100 ${
                      selectedAspect?.id === aspect.id && !selectedSubhabit ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-green-600" />
                      <span className="font-medium text-gray-900">
                        {aspect.title}
                      </span>
                      {aspect.subhabits && aspect.subhabits.length > 0 && (
                        <span className="text-xs text-gray-500">
                          ({aspect.subhabits.length})
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Subhabits List */}
                  {aspect.subhabits && aspect.subhabits.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {aspect.subhabits.map(subhabit => (
                        <button
                          key={subhabit.id}
                          onClick={() => handleSubhabitSelect(subhabit)}
                          className={`w-full text-left p-1.5 rounded text-xs hover:bg-gray-100 ${
                            selectedSubhabit?.id === subhabit.id ? 'bg-blue-50 border border-blue-200' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className="w-2 h-2 text-gray-400" />
                            <span className="text-gray-700">
                              {subhabit.title}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Comments */}
      <div className="flex-1 flex flex-col">
        {selectedAspect ? (
          <>
            {/* Comments Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                {selectedSubhabit ? (
                  <ChevronRight className="w-4 h-4 text-blue-600" />
                ) : (
                  <Target className="w-4 h-4 text-green-600" />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedSubhabit ? selectedSubhabit.title : selectedAspect.title}
                  </h2>
                  {selectedSubhabit && (
                    <p className="text-xs text-gray-500">
                      in {selectedAspect.title}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedSubhabit 
                  ? `All comments for this subhabit`
                  : `All subhabit comments for this aspect`
                }
              </p>
            </div>

            {/* Comments Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {commentsLoading ? (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500">Loading comments...</div>
                </div>
              ) : aspectComments.length > 0 ? (
                <div className="space-y-3">
                  {aspectComments.map((comment: any) => (
                    <div key={comment.id} className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-gray-900">
                          {comment.subhabit_title}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(comment.comment_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        {comment.comment}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm text-gray-500">
                    No comments yet for this aspect's subhabits
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Select an aspect to view its comments
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Aspects