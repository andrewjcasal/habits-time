import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SocialPost, SocialPostEngagementHistory } from '../types'

export function useSocialPosts() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async (platform?: 'twitter' | 'linkedin', status?: 'draft' | 'scheduled' | 'posted' | 'failed') => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('user_id', user.id)

      if (platform) {
        query = query.eq('platform', platform)
      }

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setPosts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addPost = async (
    post: Omit<SocialPost, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('social_posts')
        .insert([{ ...post, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setPosts(prev =>
        [data, ...prev.filter(p => p.id !== data.id)].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      )
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add post')
    }
  }

  const updatePost = async (
    id: string,
    updates: Partial<Omit<SocialPost, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setPosts(prev =>
        prev.map(p => (p.id === id ? data : p)).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      )
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update post')
    }
  }

  const deletePost = async (id: string) => {
    try {
      const { error } = await supabase.from('social_posts').delete().eq('id', id)

      if (error) throw error

      setPosts(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete post')
    }
  }

  const updateEngagement = async (
    postId: string,
    engagement: {
      likes_count?: number
      replies_count?: number
      shares_count?: number
      notes?: string
    }
  ) => {
    try {
      // First, update the post with new engagement counts
      const { data: postData, error: postError } = await supabase
        .from('social_posts')
        .update({
          likes_count: engagement.likes_count,
          replies_count: engagement.replies_count,
          shares_count: engagement.shares_count,
        })
        .eq('id', postId)
        .select()
        .single()

      if (postError) throw postError

      // Then, record the engagement history
      const { data: historyData, error: historyError } = await supabase
        .from('social_post_engagement_history')
        .insert([{
          social_post_id: postId,
          likes_count: engagement.likes_count || 0,
          replies_count: engagement.replies_count || 0,
          shares_count: engagement.shares_count || 0,
          notes: engagement.notes,
          recorded_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (historyError) throw historyError

      // Update local state
      setPosts(prev =>
        prev.map(p => (p.id === postId ? postData : p)).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      )

      return { post: postData, history: historyData }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update engagement')
    }
  }

  const fetchEngagementHistory = async (postId: string): Promise<SocialPostEngagementHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('social_post_engagement_history')
        .select('*')
        .eq('social_post_id', postId)
        .order('recorded_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to fetch engagement history')
    }
  }

  return {
    posts,
    loading,
    error,
    addPost,
    updatePost,
    deletePost,
    updateEngagement,
    fetchEngagementHistory,
    refetch: fetchPosts,
    fetchPosts,
  }
}