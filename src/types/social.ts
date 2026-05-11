export interface Social {
  id: string
  user_id: string
  platform: 'twitter' | 'linkedin'
  username: string
  profile_url?: string
  is_active: boolean
  knowledge?: string
  created_at: string
  updated_at: string
}

export interface SocialPost {
  id: string
  user_id: string
  social_id: string
  content: string
  hashtags?: string[]
  status: 'draft' | 'scheduled' | 'posted' | 'failed'
  likes_count?: number
  replies_count?: number
  shares_count?: number
  created_at: string
  updated_at: string
  posted_at?: string
}

export interface SocialPostEngagementHistory {
  id: string
  social_post_id: string
  likes_count: number
  replies_count: number
  shares_count: number
  recorded_at: string
  notes?: string
}
