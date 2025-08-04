import { Outlet, Link } from 'react-router-dom'
import { Crown } from 'lucide-react'

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Crown className="h-5 w-5 text-primary-600" />
              <span className="ml-1 text-xl font-semibold text-neutral-900">Cassian</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default AuthLayout
