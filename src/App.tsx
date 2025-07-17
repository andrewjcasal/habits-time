import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

// Auth
import { useAuth } from "./hooks/useAuth";

// Layouts
import MainLayout from "./layouts/MainLayout";
import AuthLayout from "./layouts/AuthLayout";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TimeTracker from "./pages/TimeTracker";
import Essentials from "./pages/Essentials";
import DailyOverrides from "./pages/DailyOverrides";
import Habits from "./pages/Habits";
import Todoist from "./pages/Todoist";
import Wins from "./pages/Wins";
import Notes from "./pages/Notes";
import Community from "./pages/Community";
import PersonDetail from "./pages/PersonDetail";
import Projects from "./pages/Projects";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";

// Components
import { WelcomeModal } from "./components/WelcomeModal";

function App() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if this is the first time the user has visited the app
    const hasVisited = localStorage.getItem("hasVisitedReflectify");
    if (!hasVisited && user) {
      setShowWelcome(true);
      localStorage.setItem("hasVisitedReflectify", "true");
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      {showWelcome && user && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}

      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route
            path="/"
            element={!user ? <Landing /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/login"
            element={!user ? <Login /> : <Navigate to="/dashboard" replace />}
          />
        </Route>

        {/* Protected routes */}
        {user ? (
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="time-tracker" element={<TimeTracker />} />
            <Route path="essentials" element={<Essentials />} />
            <Route path="daily-overrides" element={<DailyOverrides />} />
            <Route path="habits" element={<Habits />} />
            <Route path="projects" element={<Projects />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="todoist" element={<Todoist />} />
            <Route path="wins" element={<Wins />} />
            <Route path="notes" element={<Notes />} />
            <Route path="community" element={<Community />} />
            <Route path="community/:personId" element={<PersonDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/" replace />} />
        )}
      </Routes>
    </>
  );
}

export default App;
