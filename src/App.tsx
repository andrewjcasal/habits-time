import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Auth
import { useAuth } from './hooks/useAuth';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SpacedRep from './pages/SpacedRep';
import InterviewPrep from './pages/InterviewPrep';
import JobTracker from './pages/JobTracker';
import NotFound from './pages/NotFound';

// Components
import { WelcomeModal } from './components/WelcomeModal';

function App() {
  const { user, isLoading } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  
  useEffect(() => {
    // Check if this is the first time the user has visited the app
    const hasVisited = localStorage.getItem('hasVisitedFrontPrep');
    if (!hasVisited && user) {
      setShowWelcome(true);
      localStorage.setItem('hasVisitedFrontPrep', 'true');
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
        {!user && (
          <Route element={<AuthLayout />}>
            <Route index element={<Landing />} />
            <Route path="login" element={<Login />} />
          </Route>
        )}

        {/* Protected routes */}
        {user && (
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="spaced-rep" element={<SpacedRep />} />
            <Route path="interview-prep" element={<InterviewPrep />} />
            <Route path="job-tracker" element={<JobTracker />} />
          </Route>
        )}

        {/* Redirect based on auth state */}
        <Route 
          path="*" 
          element={
            user 
              ? <NotFound /> 
              : <Navigate to="/\" replace />
          } 
        />
      </Routes>
    </>
  );
}

export default App;