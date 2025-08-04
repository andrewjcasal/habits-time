import { useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthView = 'sign_in' | 'forgot_password'

const Login = () => {
  const [view, setView] = useState<AuthView>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    }
    setLoading(false)
  }


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the password reset link!')
    }
    setLoading(false)
  }

  const getTitle = () => {
    switch (view) {
      case 'forgot_password':
        return 'Forgot Password'
      default:
        return 'Login'
    }
  }

  const getButtonText = () => {
    switch (view) {
      case 'forgot_password':
        return 'Send reset email'
      default:
        return 'Sign in'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    switch (view) {
      case 'forgot_password':
        return handleForgotPassword(e)
      default:
        return handleSignIn(e)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-4 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-white py-3 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <div className="mb-2 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">{getTitle()}</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-neutral-300 rounded-md placeholder-neutral-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {view !== 'forgot_password' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-neutral-300 rounded-md placeholder-neutral-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
            )}

            {message && (
              <div className={`text-sm ${message.includes('Check your email') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-95"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Loading...
                  </div>
                ) : (
                  getButtonText()
                )}
              </button>
            </div>
          </form>

          <div className="mt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-neutral-500">Or</span>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              {view === 'sign_in' && (
                <>
                  <button
                    type="button"
                    onClick={() => window.location.href = '/sign-up'}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-500 py-2 px-4 rounded transition-all duration-200 hover:bg-blue-50 active:scale-95"
                  >
                    Don't have an account? <span className="font-medium">Sign up</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('forgot_password')}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-500 py-2 px-4 rounded transition-all duration-200 hover:bg-blue-50 active:scale-95"
                  >
                    Forgot your password?
                  </button>
                </>
              )}
              
              {view === 'forgot_password' && (
                <button
                  type="button"
                  onClick={() => setView('sign_in')}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-500 py-2 px-4 rounded transition-all duration-200 hover:bg-blue-50 active:scale-95"
                >
                  ← Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
