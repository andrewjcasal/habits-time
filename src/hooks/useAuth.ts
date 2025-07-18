import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
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

    return () => subscription.unsubscribe()
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
