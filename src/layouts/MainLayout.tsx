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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'

const MainLayout = () => {
  const location = useLocation()
  const { signOut } = useAuth()
  console.log(location)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

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
          <NavLink
            to="/settings"
            className="flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Settings className="mr-2 h-3.5 w-3.5" />
            Settings
          </NavLink>
          <button
            onClick={signOut}
            className="w-full flex items-center rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Vertical Sidebar */}
      <aside className="z-100 md:hidden w-18 flex flex-col bg-white border-r border-neutral-200 fixed h-screen z-10">
        {/* App Icon */}
        <div className="p-1 border-b border-neutral-100">
          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary-600" />
          </div>
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 py-2">
          <ul className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <li key={item.path} className="relative px-1">
                  <div className="relative">
                    <NavLink
                      to={item.path}
                      className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                        active
                          ? 'bg-primary-100 text-primary-400'
                          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                      onMouseEnter={() => setHoveredItem(item.path)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <Icon className="h-3 w-3" />
                    </NavLink>

                    {/* Popover */}
                    <AnimatePresence>
                      {hoveredItem === item.path && (
                        <motion.div
                          initial={{ opacity: 0, x: 0, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-full top-0 transform -translate-y-1/2 ml-2 z-50 bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 whitespace-nowrap"
                          style={{ zIndex: 1000 }}
                        >
                          <div className="text-sm font-medium text-neutral-900">{item.label}</div>
                          {/* Arrow */}
                          <div className="absolute right-full top-1/2 transform -translate-y-1/2">
                            <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white"></div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Settings & Logout Icons */}
        <div className="mt-auto p-1 border-t border-neutral-100 space-y-1">
          <div className="relative">
            <NavLink
              to="/settings"
              className="flex items-center justify-center w-6 h-6 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all duration-200"
              onMouseEnter={() => setHoveredItem(settingsItem.path)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <Settings className="h-3 w-3" />
            </NavLink>

            {/* Settings Popover */}
            <AnimatePresence>
              {hoveredItem === settingsItem.path && (
                <motion.div
                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-full top-0 transform -translate-y-1/2 ml-2 z-50 bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 whitespace-nowrap"
                  style={{ zIndex: 1000 }}
                >
                  <div className="text-sm font-medium text-neutral-900">{settingsItem.label}</div>
                  {/* Arrow */}
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2">
                    <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white"></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              onClick={signOut}
              className="flex items-center justify-center w-6 h-6 rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all duration-200"
              onMouseEnter={() => setHoveredItem('logout')}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <LogOut className="h-3 w-3" />
            </button>

            {/* Logout Popover */}
            <AnimatePresence>
              {hoveredItem === 'logout' && (
                <motion.div
                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-full top-0 transform -translate-y-1/2 ml-2 z-50 bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 whitespace-nowrap"
                  style={{ zIndex: 1000 }}
                >
                  <div className="text-sm font-medium text-neutral-900">Logout</div>
                  {/* Arrow */}
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2">
                    <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-white"></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-56 ml-18">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
