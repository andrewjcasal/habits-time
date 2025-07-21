// Problem type for Neetcode 150
export interface Problem {
  id: number
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  category: string
  url?: string
  description?: string
  completed: boolean
  lastAttempted: number | null
  dueDate: number | null
  notes?: string
  tags?: string[]
  level: number
  nextReview: number | null
  firstAttemptDate: number | null
}

// Company
export interface Company {
  id: string
  name: string
  size?: string
  website?: string
  industry?: string
  description?: string
  created_at?: string
  updated_at?: string
  applications: {
    position: {
      title: string
    }
  }[]
}

// Job Application
export interface JobApplication {
  id: number
  company: Company
  position: string
  applied_date: string
  status: 'applied' | 'interviewing' | 'rejected' | 'offered' | 'accepted'
  url?: string
  notes?: string
}

// Contact
export interface Contact {
  id: string
  user_id?: string
  name: string
  company?: string
  role?: string
  email?: string
  phone?: string
  notes?: string
  last_contact_date?: string // ISO string
  created_at?: string
  updated_at?: string
}

// Networking Action
export interface NetworkingAction {
  id: number
  user_id: string
  contact_id?: string
  contact_name: string
  company: string
  role: string
  action_taken: string
  follow_up_date?: string
  note?: string
  created_at: string
}

// Interview types
export type InterviewType = 'coding' | 'systemDesign' | 'apiDesign'

// Message in interview session
export interface Message {
  id: number
  sender: 'user' | 'ai' | 'system'
  content: string
  timestamp: number
}

// Interview session
export interface InterviewSession {
  id: number
  type: InterviewType
  jobDescription: string
  additionalInfo?: string
  date: number // timestamp
  messages: Message[]
  evaluation: any | null
}

// Spaced Repetition Levels
export interface SpacedRepLevel {
  days: number
  totalDays: number
  nextLevel: number
}

export const SPACED_REP_LEVELS: SpacedRepLevel[] = [
  { days: 1, totalDays: 1, nextLevel: 3 }, // Level 0 -> 1: Review next day
  { days: 2, totalDays: 3, nextLevel: 7 }, // Level 1 -> 2: Review in 2 days
  { days: 4, totalDays: 7, nextLevel: 14 }, // Level 2 -> 3: Review in 4 days
  { days: 7, totalDays: 14, nextLevel: 30 }, // Level 3 -> 4: Review in 7 days
  { days: 16, totalDays: 30, nextLevel: 60 }, // Level 4 -> 5: Review in 16 days
  { days: 30, totalDays: 60, nextLevel: 120 }, // Level 5 -> 6: Review in 30 days
  { days: 60, totalDays: 120, nextLevel: -1 }, // Level 6: Review in 60 days, then done
]

export interface TodoType {
  id: number
  name: string
  script: string
}

// Essential for daily time tracking
export interface Essential {
  id: string
  user_id: string
  activity_type_id: string
  daily_minutes: number
  created_at: string
  updated_at: string
}

// Daily override for essentials
export interface DailyOverride {
  id: string
  user_id: string
  essential_id: string
  date: string
  minutes: number
  created_at: string
  updated_at: string
}

// Behavior for dashboard
export interface Behavior {
  id: string
  user_id: string
  name: string
  description?: string
  category?: string
  created_at: string
  updated_at: string
}

// Daily reflection
export interface DailyReflection {
  id: string
  user_id: string
  reflection_date: string
  content: string
  reddit_links?: RedditPost[]
  generated_at: string
}

// Reddit post
export interface RedditPost {
  title: string
  url: string
  subreddit: string
  upvotes: number
  comments: number
}

// Habit note
export interface HabitNote {
  id: string
  user_id: string
  note_date: string
  content: string
  created_at: string
  updated_at: string
}

// Project
export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  color?: string
  hourly_rate?: number
  has_sessions?: boolean
  created_at: string
  updated_at: string
}

// Task
export interface Task {
  id: string
  project_id: string
  user_id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  estimated_hours?: number
  parent_task_id?: string
  created_at: string
  updated_at: string
  subtasks?: Task[]
}

// Person
export interface Person {
  id: string
  user_id: string
  name: string
  email?: string
  phone?: string
  company?: string
  role?: string
  notes?: string
  linkedin_url?: string
  twitter_url?: string
  website_url?: string
  last_contact_date?: string
  created_at: string
  updated_at: string
}

// Experience
export interface Experience {
  id: string
  user_id: string
  title: string
  description?: string
  experience_date: string
  type: 'shared' | 'individual' | 'meeting' | 'event' | 'other'
  location?: string
  outcome?: string
  follow_up_needed: boolean
  follow_up_date?: string
  connection_strength: 'strengthened' | 'maintained' | 'weakened' | 'neutral'
  topics_discussed?: string[]
  next_steps?: string
  created_at: string
  updated_at: string
  attendees?: ExperienceAttendee[]
}

// Experience Attendee junction table
export interface ExperienceAttendee {
  id: string
  experience_id: string
  person_id: string
  created_at: string
  person?: Person
}

// Contract
export interface Contract {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'cancelled'
  start_date?: string
  end_date?: string
  created_at: string
  updated_at: string
}

// Session
export interface Session {
  id: string
  user_id: string
  project_id: string
  scheduled_date: string
  scheduled_hours: number
  actual_start_time?: string // Now stores time only (HH:MM:SS)
  actual_end_time?: string // Now stores time only (HH:MM:SS)
  actual_hours?: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
  projects?: {
    name: string
    color?: string
  }
}

// Contract Session
export interface ContractSession {
  id: string
  contract_id: string
  session_id: string
  created_at: string
}

// Meeting
export interface Meeting {
  id: string
  user_id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  attendees?: string[]
  meeting_type: 'general' | 'work' | 'personal' | 'appointment'
  priority: 'low' | 'medium' | 'high'
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

// Social media account
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

// Social media post
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

// Social post engagement history
export interface SocialPostEngagementHistory {
  id: string
  social_post_id: string
  likes_count: number
  replies_count: number
  shares_count: number
  recorded_at: string
  notes?: string
}
