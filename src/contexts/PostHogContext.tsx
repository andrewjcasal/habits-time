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
      console.log('PostHog: Tracking pageview for', location.pathname)
      posthog.capture('$pageview', { path: location.pathname })
    }
  }, [location.pathname])

  // Identify user when they log in
  useEffect(() => {
    if (user?.id) {
      console.log('PostHog: Identifying user', user.id)
      posthog.identify(user.id, {
        email: user.email,
        // Add any other user properties you want to track
      })
    } else {
      console.log('PostHog: Resetting user session')
      posthog.reset()
    }
  }, [user])

  const track = (event: string, properties?: Record<string, any>) => {
    console.log('PostHog: Tracking event', event, properties)
    posthog.capture(event, properties)
  }

  const identify = (userId: string, properties?: Record<string, any>) => {
    console.log('PostHog: Identifying user', userId)
    posthog.identify(userId, properties)
  }

  const reset = () => {
    console.log('PostHog: Resetting session')
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
