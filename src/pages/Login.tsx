import { useState } from 'react'
import { Link } from 'react-router-dom'
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

  const handleSubmit = (e: React.FormEvent) => {
    if (view === 'forgot_password') return handleForgotPassword(e)
    return handleSignIn(e)
  }

  const title = view === 'forgot_password' ? 'Reset password' : 'Sign in'
  const buttonText = view === 'forgot_password' ? 'Send reset email' : 'Sign in'

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1
            className="text-2xl tracking-tight text-neutral-900 mb-2"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            {title}
          </h1>
          {view === 'sign_in' && (
            <p className="text-sm text-neutral-400">
              Welcome back to Cassian
            </p>
          )}
          {view === 'forgot_password' && (
            <p className="text-sm text-neutral-400">
              We'll send you a link to reset it
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-neutral-500 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border rounded-lg text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors"
              style={{ borderColor: '#E8E2D9' }}
              placeholder="you@example.com"
            />
          </div>

          {view !== 'forgot_password' && (
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-neutral-500 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white border rounded-lg text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-colors"
                style={{ borderColor: '#E8E2D9' }}
                placeholder="Enter your password"
              />
            </div>
          )}

          {message && (
            <p className={`text-xs ${message.includes('Check your email') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              buttonText
            )}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center">
          {view === 'sign_in' && (
            <>
              <button
                type="button"
                onClick={() => setView('forgot_password')}
                className="block w-full text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Forgot your password?
              </button>
              <p className="text-xs text-neutral-400">
                No account?{' '}
                <Link to="/sign-up" className="text-amber-700 hover:text-amber-800 font-medium transition-colors">
                  Sign up
                </Link>
              </p>
            </>
          )}
          {view === 'forgot_password' && (
            <button
              type="button"
              onClick={() => setView('sign_in')}
              className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
