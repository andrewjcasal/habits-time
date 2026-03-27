import { Outlet, Link } from 'react-router-dom'

const AuthLayout = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFBF7' }}>
      <header className="border-b" style={{ borderColor: '#E8E2D9' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link to="/" className="flex items-center group">
              <span
                className="text-lg tracking-tight text-neutral-900"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Cassian
              </span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/login"
                className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="text-sm font-medium text-white px-4 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 transition-colors"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Get Started
              </Link>
            </nav>
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
