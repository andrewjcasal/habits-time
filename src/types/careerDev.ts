// Job-search and career-development types: interview prep, problem
// tracking (Neetcode 150), networking pipeline, daily reflections.

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

export interface JobApplication {
  id: number
  company: Company
  position: string
  applied_date: string
  status: 'applied' | 'interviewing' | 'rejected' | 'offered' | 'accepted'
  url?: string
  notes?: string
}

export type InterviewType = 'coding' | 'systemDesign' | 'apiDesign'

export interface Message {
  id: number
  sender: 'user' | 'ai' | 'system'
  content: string
  timestamp: number
}

export interface InterviewSession {
  id: number
  type: InterviewType
  jobDescription: string
  additionalInfo?: string
  date: number // timestamp
  messages: Message[]
  evaluation: any | null
}

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

export interface RedditPost {
  title: string
  url: string
  subreddit: string
  upvotes: number
  comments: number
}

export interface DailyReflection {
  id: string
  user_id: string
  reflection_date: string
  content: string
  reddit_links?: RedditPost[]
  generated_at: string
}
