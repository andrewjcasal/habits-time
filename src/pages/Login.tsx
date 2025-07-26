import { useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password'

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the confirmation link!')
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
      case 'sign_up':
        return 'Sign up'
      case 'forgot_password':
        return 'Forgot Password'
      default:
        return 'Login'
    }
  }

  const getButtonText = () => {
    switch (view) {
      case 'sign_up':
        return 'Sign up'
      case 'forgot_password':
        return 'Send reset email'
      default:
        return 'Sign in'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    switch (view) {
      case 'sign_up':
        return handleSignUp(e)
      case 'forgot_password':
        return handleForgotPassword(e)
      default:
        return handleSignIn(e)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">{getTitle()}</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    autoComplete={view === 'sign_up' ? 'new-password' : 'current-password'}
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
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : getButtonText()}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-neutral-500">Or</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {view === 'sign_in' && (
                <>
                  <button
                    type="button"
                    onClick={() => setView('sign_up')}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
                  >
                    Don't have an account? Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('forgot_password')}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
                  >
                    Forgot your password?
                  </button>
                </>
              )}
              
              {view === 'sign_up' && (
                <button
                  type="button"
                  onClick={() => setView('sign_in')}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
                >
                  Already have an account? Sign in
                </button>
              )}
              
              {view === 'forgot_password' && (
                <button
                  type="button"
                  onClick={() => setView('sign_in')}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
                >
                  Back to sign in
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
