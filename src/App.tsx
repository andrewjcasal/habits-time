import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import SpacedRep from './pages/SpacedRep';
import InterviewPrep from './pages/InterviewPrep';
import JobTracker from './pages/JobTracker';
import NotFound from './pages/NotFound';

// Components
import { WelcomeModal } from './components/WelcomeModal';

function App() {
  const [showWelcome, setShowWelcome] = useState(false);
  
  useEffect(() => {
    // Check if this is the first time the user has visited the app
    const hasVisited = localStorage.getItem('hasVisitedFrontPrep');
    if (!hasVisited) {
      setShowWelcome(true);
      localStorage.setItem('hasVisitedFrontPrep', 'true');
    }
  }, []);

  return (
    <>
      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}
      
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="spaced-rep" element={<SpacedRep />} />
          <Route path="interview-prep" element={<InterviewPrep />} />
          <Route path="job-tracker" element={<JobTracker />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;