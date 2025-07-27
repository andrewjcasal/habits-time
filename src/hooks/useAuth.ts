import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Add timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.log('⏰ Auth: Timeout reached, stopping loading state')
      setIsLoading(false)
    }, 10000) // 10 second timeout

    // Get initial session
    console.log('🔍 Auth: Checking initial session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🔍 Auth: getSession result:', { session: !!session, user: !!session?.user, error })
      if (session) {
        console.log('✅ Auth: Session found, user:', session.user.email)
      } else {
        console.log('❌ Auth: No session found')
      }
      setUser(session?.user ?? null)
      setIsLoading(false)
      clearTimeout(authTimeout)
    }).catch(err => {
      console.error('❌ Auth: Error getting session:', err)
      setIsLoading(false)
      clearTimeout(authTimeout)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 Auth: State change event:', event, { session: !!session, user: !!session?.user })
      const newUser = session?.user ?? null
      setUser(newUser)
      setIsLoading(false)

      // Only redirect on specific auth events, not on token refresh
      if (event === 'SIGNED_OUT' && !newUser) {
        console.log('🚪 Auth: Signing out, redirecting to login')
        navigate('/login')
      }
      // Don't redirect on SIGNED_IN as it can interfere with navigation
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(authTimeout)
    }
  }, [navigate])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    user,
    isLoading,
    signOut,
  }
}
