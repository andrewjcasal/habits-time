import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Auth
import { useUserContext } from './contexts/UserContext'

// Layouts
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import TimeTracker from './pages/TimeTracker'
import Essentials from './pages/Essentials'
import DailyOverrides from './pages/DailyOverrides'
import Habits from './pages/Habits'
import TodoistTriage from './pages/TodoistTriage'
import Wins from './pages/Wins'
import Notes from './pages/Notes'
import Issues from './pages/Issues'
import Community from './pages/Community'
import PersonDetail from './pages/PersonDetail'
import Projects from './pages/Projects'
import HabitDetail from './pages/HabitDetail'
import Aspects from './pages/Aspects'
import AspectDetail from './pages/AspectDetail'
import Calendar from './pages/Calendar'
import Categories from './pages/Categories'
import Buffers from './pages/Buffers'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'

// Components
function App() {
  const { user, loading: isLoading } = useUserContext()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={!user ? <Landing /> : <Navigate to="/calendar" replace />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/calendar" replace />} />
          <Route
            path="/sign-up"
            element={!user ? <SignUp /> : <Navigate to="/calendar" replace />}
          />
        </Route>

        {/* Protected routes */}
        {user ? (
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/calendar" replace />} />
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="reflections" element={<Dashboard />} />
            <Route path="time-tracker" element={<TimeTracker />} />
            <Route path="essentials" element={<Essentials />} />
            <Route path="daily-overrides" element={<DailyOverrides />} />
            <Route path="habits" element={<Habits />} />
            <Route path="habits/:habitId" element={<HabitDetail />} />
            <Route path="aspects" element={<Aspects />} />
            <Route path="habits/aspect/:aspectId" element={<AspectDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="categories" element={<Categories />} />
            <Route path="buffers" element={<Buffers />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="todoist" element={<TodoistTriage />} />
            <Route path="wins" element={<Wins />} />
            <Route path="notes" element={<Notes />} />
            <Route path="issues" element={<Issues />} />
            <Route path="community" element={<Community />} />
            <Route path="community/:personId" element={<PersonDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        ) : (
          <>
            {/* Public project route - accessible without authentication */}
            <Route path="/projects" element={<Projects />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </>
  )
}

export default App
