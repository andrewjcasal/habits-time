import posthog from 'posthog-js'

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY
    
    if (!posthogKey) {
      console.warn('PostHog: VITE_POSTHOG_KEY not found in environment variables')
      return
    }
    
    
    
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // We'll handle this manually for better control
      capture_pageleave: true,
      disable_session_recording: true,
      toolbar: false, // Disable toolbar to avoid console noise
      loaded: posthog => {
        
        if (import.meta.env.DEV) {
          posthog.debug()
        }
      },
    })
  }
}

export { posthog }
