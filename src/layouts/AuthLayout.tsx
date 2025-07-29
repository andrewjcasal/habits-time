import { Outlet, Link } from 'react-router-dom'
import { Bot } from 'lucide-react'

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Bot className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-xl font-semibold text-neutral-900">Cassian</span>
            </div>
            <div>
              <Link
                to="/login"
                className="text-sm font-semibold leading-6 text-neutral-900 hover:text-blue-600 transition-colors"
              >
                Sign in <span aria-hidden="true">&rarr;</span>
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
