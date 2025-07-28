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
      setIsLoading(false)
    }, 10000) // 10 second timeout

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
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
      const newUser = session?.user ?? null
      setUser(newUser)
      setIsLoading(false)

      // Only redirect on specific auth events, not on token refresh
      if (event === 'SIGNED_OUT' && !newUser) {
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
