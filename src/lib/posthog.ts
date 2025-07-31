import posthog from 'posthog-js'

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY
    
    if (!posthogKey) {
      console.warn('PostHog: VITE_POSTHOG_KEY not found in environment variables')
      return
    }
    
    console.log('PostHog: Initializing with key:', posthogKey.substring(0, 8) + '...')
    
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // We'll handle this manually for better control
      capture_pageleave: true,
      disable_session_recording: true,
      toolbar: false, // Disable toolbar to avoid console noise
      loaded: posthog => {
        console.log('PostHog: Successfully loaded')
        if (import.meta.env.DEV) {
          posthog.debug()
        }
      },
    })
  }
}

export { posthog }
