import { useState, useEffect } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

const Login = () => {
  const [view, setView] = useState<'sign_in' | 'sign_up' | 'forgotten_password'>('sign_in')

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const signUpButton = document.querySelector('button[data-supabase-element="sign_up"]')
      const signInButton = document.querySelector('button[data-supabase-element="sign_in"]')
      const linkText = document.querySelector('.supabase-auth-ui_ui-anchor')?.textContent
      const forgotPasswordButton = document.querySelector(
        'button[data-supabase-element="forgotten_password"]'
      )

      // Check for forgot password view
      if (linkText?.includes('Sign in') && !linkText?.includes('Sign up') && !signUpButton) {
        setView('forgotten_password')
      } else if (linkText?.includes('Sign up') || signUpButton) {
        setView('sign_in')
      } else if (linkText?.includes('Sign in') || signInButton) {
        setView('sign_up')
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => observer.disconnect()
  }, [])

  const getTitle = () => {
    switch (view) {
      case 'sign_up':
        return 'Sign up'
      case 'forgotten_password':
        return 'Forgot Password'
      default:
        return 'Login'
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">{getTitle()}</h2>
          </div>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb',
                    brandAccent: '#1d4ed8',
                  },
                },
              },
            }}
            providers={[]}
            socialLayout="horizontal"
          />
        </div>
      </div>
    </div>
  )
}

export default Login
