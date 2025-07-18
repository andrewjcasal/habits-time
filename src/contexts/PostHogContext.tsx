import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { initPostHog, posthog } from '../lib/posthog'
import { useAuth } from '../hooks/useAuth'

interface PostHogContextType {
  track: (event: string, properties?: Record<string, any>) => void
  identify: (userId: string, properties?: Record<string, any>) => void
  reset: () => void
}

const PostHogContext = createContext<PostHogContextType | null>(null)

interface PostHogProviderProps {
  children: ReactNode
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  const location = useLocation()
  const { user } = useAuth()

  useEffect(() => {
    initPostHog()
  }, [])

  // Track page views
  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.capture('$pageview')
    }
  }, [location.pathname])

  // Identify user when they log in
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
        // Add any other user properties you want to track
      })
    } else {
      posthog.reset()
    }
  }, [user])

  const track = (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties)
  }

  const identify = (userId: string, properties?: Record<string, any>) => {
    posthog.identify(userId, properties)
  }

  const reset = () => {
    posthog.reset()
  }

  const value = {
    track,
    identify,
    reset,
  }

  return <PostHogContext.Provider value={value}>{children}</PostHogContext.Provider>
}

export function usePostHog() {
  const context = useContext(PostHogContext)
  if (!context) {
    throw new Error('usePostHog must be used within a PostHogProvider')
  }
  return context
}
