import { useState, useEffect } from 'react'
import { 
  Plus, 
  Filter, 
  MessageSquare, 
  Heart, 
  Share, 
  Clock, 
  CheckCircle, 
  Calendar,
  Edit,
  History,
  X
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useSocialPosts } from '../hooks/useSocialPosts'
import { SocialPost, SocialPostEngagementHistory } from '../types'
import LoadingSpinner from './LoadingSpinner'

interface SocialPostsFeedProps {
  selectedAccountId: string | null
  onCreatePost?: () => void
}

type PlatformFilter = 'all' | 'twitter' | 'linkedin'
type StatusFilter = 'all' | 'draft' | 'scheduled' | 'posted' | 'failed'

export const SocialPostsFeed = ({ selectedAccountId, onCreatePost }: SocialPostsFeedProps) => {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingEngagement, setEditingEngagement] = useState<string | null>(null)
  const [engagementForm, setEngagementForm] = useState({
    likes_count: 0,
    replies_count: 0,
    shares_count: 0,
    notes: ''
  })
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [engagementHistory, setEngagementHistory] = useState<SocialPostEngagementHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const { 
    posts, 
    loading, 
    error, 
    updateEngagement, 
    fetchEngagementHistory,
    fetchPosts 
  } = useSocialPosts()

  // Filter posts based on selectedAccountId and filters
  const filteredPosts = posts.filter(post => {
    // Filter by account if selected
    if (selectedAccountId && post.social_id !== selectedAccountId) {
      return false
    }
    
    // Filter by platform
    if (platformFilter !== 'all' && post.platform !== platformFilter) {
      return false
    }
    
    // Filter by status
    if (statusFilter !== 'all' && post.status !== statusFilter) {
      return false
    }
    
    return true
  })

  // Fetch posts when filters change
  useEffect(() => {
    const platform = platformFilter === 'all' ? undefined : platformFilter
    const status = statusFilter === 'all' ? undefined : statusFilter
    fetchPosts(platform, status)
  }, [platformFilter, statusFilter, fetchPosts])

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'twitter':
        return (
          <div className="w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center">
            <span className="text-xs font-bold">X</span>
          </div>
        )
      case 'linkedin':
        return (
          <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center">
            <span className="text-xs font-bold">in</span>
          </div>
        )
      default:
        return <div className="w-5 h-5 bg-gray-500 rounded-full" />
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      posted: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const handleEditEngagement = (post: SocialPost) => {
    setEditingEngagement(post.id)
    setEngagementForm({
      likes_count: post.likes_count || 0,
      replies_count: post.replies_count || 0,
      shares_count: post.shares_count || 0,
      notes: ''
    })
  }

  const handleSaveEngagement = async (postId: string) => {
    try {
      await updateEngagement(postId, engagementForm)
      setEditingEngagement(null)
      setEngagementForm({ likes_count: 0, replies_count: 0, shares_count: 0, notes: '' })
    } catch (err) {
      console.error('Failed to update engagement:', err)
    }
  }

  const handleCancelEdit = () => {
    setEditingEngagement(null)
    setEngagementForm({ likes_count: 0, replies_count: 0, shares_count: 0, notes: '' })
  }

  const handleShowHistory = async (postId: string) => {
    if (showHistory === postId) {
      setShowHistory(null)
      return
    }

    setLoadingHistory(true)
    try {
      const history = await fetchEngagementHistory(postId)
      setEngagementHistory(history)
      setShowHistory(postId)
    } catch (err) {
      console.error('Failed to fetch engagement history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  if (loading && posts.length === 0) {
    return <LoadingSpinner message="Loading posts..." fullScreen={false} />
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Posts</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchPosts()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
        <div className="mt-6 text-sm text-gray-500">
          <p>Make sure you've run the database migrations for the social posting tables.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with filters and create button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          
          {/* Platform Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
              className="text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Platforms</option>
              <option value="twitter">X/Twitter</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Posts count */}
      <div className="text-sm text-gray-600">
        {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
        {selectedAccountId && ' for selected account'}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800 text-sm">Error: {error}</p>
        </div>
      )}

      {/* Posts Feed */}
      <div>
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded border border-gray-200">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
            <p className="text-gray-600 text-sm mb-4">
              {selectedAccountId 
                ? 'This account doesn\'t have any posts yet.' 
                : 'You haven\'t created any posts yet.'}
            </p>
            {onCreatePost && (
              <button 
                onClick={onCreatePost}
                className="bg-blue-600 text-white px-4 py-2 text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Create Your First Post
              </button>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="bg-white rounded border-b border-gray-200 p-2 hover:shadow-sm transition-shadow">
              {/* Post Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getPlatformIcon(post.platform)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {post.platform === 'twitter' ? 'X/Twitter' : post.platform}
                      </span>
                      {getStatusBadge(post.status)}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {post.status === 'posted' && post.posted_at
                          ? `Posted ${formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })}`
                          : `Updated ${formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}`
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleShowHistory(post.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View engagement history"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Post Content */}
              <div className="mb-4">
                <p className="text-gray-900 whitespace-pre-wrap">
                  {truncateContent(post.content)}
                </p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {post.hashtags.map((tag, index) => (
                      <span key={index} className="text-blue-600 text-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Engagement Metrics */}
              {post.status === 'posted' && (
                <div className="border-t border-gray-100 pt-4">
                  {editingEngagement === post.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Likes</label>
                          <input
                            type="number"
                            value={engagementForm.likes_count}
                            onChange={(e) => setEngagementForm({
                              ...engagementForm,
                              likes_count: parseInt(e.target.value) || 0
                            })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Replies</label>
                          <input
                            type="number"
                            value={engagementForm.replies_count}
                            onChange={(e) => setEngagementForm({
                              ...engagementForm,
                              replies_count: parseInt(e.target.value) || 0
                            })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Shares</label>
                          <input
                            type="number"
                            value={engagementForm.shares_count}
                            onChange={(e) => setEngagementForm({
                              ...engagementForm,
                              shares_count: parseInt(e.target.value) || 0
                            })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                            min="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                        <input
                          type="text"
                          value={engagementForm.notes}
                          onChange={(e) => setEngagementForm({
                            ...engagementForm,
                            notes: e.target.value
                          })}
                          placeholder="Optional notes about this update..."
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSaveEngagement(post.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors flex items-center"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Heart className="w-4 h-4" />
                          <span className="text-sm">{post.likes_count || 0}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm">{post.replies_count || 0}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Share className="w-4 h-4" />
                          <span className="text-sm">{post.shares_count || 0}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditEngagement(post)}
                        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Update</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Engagement History */}
              {showHistory === post.id && (
                <div className="border-t border-gray-100 mt-4 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Engagement History</h4>
                  {loadingHistory ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600 text-xs">Loading history...</p>
                    </div>
                  ) : engagementHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm">No engagement history recorded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {engagementHistory.map((record) => (
                        <div key={record.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-900">
                              {record.likes_count} likes, {record.replies_count} replies, {record.shares_count} shares
                            </span>
                            {record.notes && (
                              <span className="text-gray-600">"{record.notes}"</span>
                            )}
                          </div>
                          <span className="text-gray-500 text-xs">
                            {formatDistanceToNow(new Date(record.recorded_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Loading indicator for additional requests */}
      {loading && posts.length > 0 && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}
    </div>
  )
}