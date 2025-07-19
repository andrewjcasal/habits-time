import { Outlet, NavLink } from 'react-router-dom'
import { useLocation } from 'react-router'
import { useState } from 'react'
import {
  Layout,
  Home,
  Code,
  Briefcase,
  Users,
  Settings,
  Heart,
  Clock,
  Star,
  Calendar,
  FileText,
  Trophy,
  CheckSquare,
  FolderOpen,
  LogOut,
  Bot,
  Menu,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import FeedbackButton from '../components/FeedbackButton'

const MainLayout = () => {
  const location = useLocation()
  const { signOut } = useAuth()
  console.log(location)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/time-tracker', label: 'Time Tracker', icon: Clock },
    { path: '/habits', label: 'Habits', icon: Heart },
    { path: '/projects', label: 'Projects', icon: FolderOpen },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/community', label: 'Community', icon: Users },
    { path: '/todoist', label: 'Todoist', icon: CheckSquare },
    { path: '/wins', label: 'Wins', icon: Trophy },
    { path: '/notes', label: 'Notes', icon: FileText },
  ]

  const settingsItem = { path: '/settings', label: 'Settings', icon: Settings }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-white border-r border-neutral-200 fixed h-screen z-10">
        <div className="p-4">
          <h1 className="text-lg font-semibold text-primary-700 flex items-center">
            <Bot className="w-4 h-4 mr-2 text-primary-600" />
            Reflectify
          </h1>
        </div>

        <nav className="flex-1 px-2 pb-4">
          <ul className="space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`
                    }
                  >
                    <Icon className="mr-2 h-3.5 w-3.5" />
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-auto p-1 border-t border-neutral-200 space-y-1">
          <a
            href="https://ko-fi.com/andrewjcasal"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Heart className="mr-2 h-3.5 w-3.5" />
            Support
          </a>
          <div className="flex items-center gap-1">
            <NavLink
              to="/settings"
              className="flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 flex-1"
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Settings
            </NavLink>
            <button
              onClick={signOut}
              className="flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header with Hamburger */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-neutral-200 px-1 py-1 z-30 flex items-center justify-between">
        <div className="flex items-center">
          <Bot className="w-3 h-3 mr-1 text-primary-600" />
          <h1 className="text-base font-semibold text-primary-700">Reflectify</h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        >
          {mobileMenuOpen ? <X className="h-3 w-3" /> : <Menu className="h-3 w-3" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="md:hidden fixed top-0 right-0 h-full w-64 bg-white border-l border-neutral-200 z-50 flex flex-col"
            >
              {/* Close button and first nav item on same line */}
              <div className="flex items-center justify-between p-0">
                <NavLink
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center rounded-md px-1 py-1 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`
                  }
                >
                  <Home className="mr-1 h-2 w-2" />
                  Dashboard
                </NavLink>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-0 py-0">
                <ul className="space-y-1">
                  {navItems.slice(1).map(item => {
                    const Icon = item.icon
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center rounded-md px-1 py-1 text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                            }`
                          }
                        >
                          <Icon className="mr-1 h-2 w-2" />
                          {item.label}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              {/* Footer */}
              <div className="p-0 border-t border-neutral-200 space-y-1">
                <a
                  href="https://ko-fi.com/andrewjcasal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Heart className="mr-1 h-2 w-2" />
                  Support
                </a>
                <NavLink
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                  <Settings className="mr-1 h-2 w-2" />
                  Settings
                </NavLink>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    signOut()
                  }}
                  className="flex items-center w-full rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                  <LogOut className="mr-1 h-2 w-2" />
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 w-full md:w-auto">
        <Outlet />
      </main>

      {/* Feedback Button */}
      <FeedbackButton />
    </div>
  )
}

export default MainLayout
