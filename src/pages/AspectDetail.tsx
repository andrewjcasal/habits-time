import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Target, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
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

const AspectDetail = () => {
  const { aspectId } = useParams<{ aspectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [aspect, setAspect] = useState<Aspect | null>(null)
  const [selectedSubhabit, setSelectedSubhabit] = useState<Subhabit | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)

  const fetchAspect = async () => {
    if (!aspectId) return

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
        .eq('id', aspectId)
        .single()

      if (error) throw error
      setAspect(data)

      // Auto-load comments for the aspect
      fetchComments(undefined, aspectId)
    } catch (err) {
      console.error('Error fetching aspect:', err)
      navigate('/habits') // Go back if aspect not found
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (subhabitId?: string, aspectIdParam?: string) => {
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
      } else if (aspectIdParam) {
        query = query.eq('subhabits.aspect_id', aspectIdParam)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      const commentsData = data?.map((comment: any) => ({
        id: comment.id,
        comment: comment.comment,
        comment_date: comment.comment_date,
        subhabit_title: comment.subhabits.title,
        created_at: comment.created_at
      })) || []

      setComments(commentsData)
    } catch (err) {
      console.error('Error fetching comments:', err)
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleSubhabitSelect = (subhabit: Subhabit) => {
    setSelectedSubhabit(subhabit)
    fetchComments(subhabit.id)
  }

  const handleAspectSelect = () => {
    setSelectedSubhabit(null)
    fetchComments(undefined, aspectId)
  }

  useEffect(() => {
    fetchAspect()
  }, [aspectId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingSpinner message="Loading aspect..." />
      </div>
    )
  }

  if (!aspect) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Aspect not found</p>
          <button
            onClick={() => navigate('/habits')}
            className="mt-2 text-blue-600 hover:text-blue-700"
          >
            Go back to habits
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Icon Navigation */}
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center">
        {/* Back Button */}
        <div className="p-2 border-b border-gray-200 w-full flex justify-center">
          <button
            onClick={() => navigate('/habits')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect and Subhabits Icons */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 w-full">
          {/* Aspect Button */}
          <div className="flex justify-center">
            <button
              onClick={handleAspectSelect}
              className={`p-2 rounded-full transition-colors ${
                !selectedSubhabit ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title={aspect.title}
            >
              <Target className="w-4 h-4" />
            </button>
          </div>

          {/* Subhabits Icons */}
          {aspect.subhabits && aspect.subhabits.length > 0 && (
            <>
              {aspect.subhabits.map(subhabit => {
                const initial = subhabit.title.charAt(0).toUpperCase()
                return (
                  <div key={subhabit.id} className="flex justify-center">
                    <button
                      onClick={() => handleSubhabitSelect(subhabit)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                        selectedSubhabit?.id === subhabit.id 
                          ? 'bg-blue-100 text-blue-600 border-2 border-blue-300' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'
                      }`}
                      title={subhabit.title}
                    >
                      {initial}
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Comments */}
      <div className="flex-1 flex flex-col">
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
                {selectedSubhabit ? selectedSubhabit.title : aspect.title}
              </h2>
              {selectedSubhabit && (
                <p className="text-xs text-gray-500">
                  in {aspect.title}
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
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment: any) => (
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
                {selectedSubhabit 
                  ? `No comments yet for this subhabit`
                  : `No comments yet for this aspect's subhabits`
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AspectDetail