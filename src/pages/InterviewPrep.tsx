import { useState } from 'react';
import { ArrowRight, Clipboard, TerminalSquare, Database, Send, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

// Components
import { InterviewForm } from '../components/InterviewForm';
import { AiInterviewer } from '../components/AiInterviewer';

// Types
import { InterviewSession, InterviewType } from '../types';

const InterviewPrep = () => {
  const [activeTab, setActiveTab] = useState<InterviewType | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  
  // Load previous sessions
  useState(() => {
    const savedSessions = localStorage.getItem('interview-history');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }
  });
  
  const handleStartInterview = (type: InterviewType) => {
    setActiveTab(type);
  };
  
  const handleSubmitForm = (formData: { jobDescription: string, additionalInfo: string }) => {
    setJobDescription(formData.jobDescription);
    setAdditionalInfo(formData.additionalInfo);
    
    // Create new session
    const newSession: InterviewSession = {
      id: Date.now(),
      type: activeTab as InterviewType,
      jobDescription: formData.jobDescription,
      additionalInfo: formData.additionalInfo,
      date: Date.now(),
      messages: [],
      evaluation: null
    };
    
    setCurrentSession(newSession);
    
    // Add to sessions and save to localStorage
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    localStorage.setItem('interview-history', JSON.stringify(updatedSessions));
  };
  
  const handleEndSession = (evaluation: any) => {
    if (currentSession) {
      // Update session with evaluation
      const updatedSession = {
        ...currentSession,
        evaluation
      };
      
      // Update sessions list
      const updatedSessions = sessions.map(s => 
        s.id === updatedSession.id ? updatedSession : s
      );
      
      setSessions(updatedSessions);
      localStorage.setItem('interview-history', JSON.stringify(updatedSessions));
      
      // Reset current session
      setCurrentSession(null);
      setActiveTab(null);
    }
  };
  
  const renderInterviewContent = () => {
    if (currentSession) {
      return (
        <AiInterviewer 
          session={currentSession} 
          onEndSession={handleEndSession} 
        />
      );
    }
    
    if (activeTab) {
      return (
        <InterviewForm 
          type={activeTab} 
          onSubmit={handleSubmitForm} 
          onCancel={() => setActiveTab(null)}
        />
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InterviewTypeCard 
          title="Coding Interview"
          icon={<Clipboard className="w-6 h-6 text-primary-600" />}
          description="Practice solving coding challenges with feedback on your approach, solution, and communication."
          color="primary"
          onClick={() => handleStartInterview('coding')}
        />
        
        <InterviewTypeCard 
          title="System Design"
          icon={<TerminalSquare className="w-6 h-6 text-secondary-600" />}
          description="Practice designing scalable systems and architectures for various requirements and constraints."
          color="secondary"
          onClick={() => handleStartInterview('systemDesign')}
        />
        
        <InterviewTypeCard 
          title="API Design"
          icon={<Database className="w-6 h-6 text-accent-600" />}
          description="Practice designing RESTful APIs, GraphQL schemas, and other API patterns for various use cases."
          color="accent"
          onClick={() => handleStartInterview('apiDesign')}
        />
      </div>
    );
  };
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Interview Preparation</h1>
          <p className="text-neutral-600 mt-1">Practice with an AI interviewer to prepare for your interviews</p>
        </div>
        
        {currentSession && (
          <button 
            onClick={() => {
              setCurrentSession(null);
              setActiveTab(null);
            }}
            className="btn btn-outline"
          >
            End Session
          </button>
        )}
      </div>
      
      {renderInterviewContent()}
      
      {/* Previous Sessions */}
      {!currentSession && !activeTab && sessions.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-medium mb-4">Previous Sessions</h2>
          <div className="space-y-4">
            {sessions.map(session => (
              <motion.div 
                key={session.id}
                className="card bg-white hover:shadow-md transition-shadow cursor-pointer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => setCurrentSession(session)}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="flex items-center">
                      <span 
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          session.type === 'coding' 
                            ? 'bg-primary-500' 
                            : session.type === 'systemDesign' 
                              ? 'bg-secondary-500' 
                              : 'bg-accent-500'
                        }`} 
                      />
                      <h3 className="font-medium">{
                        session.type === 'coding' 
                          ? 'Coding Interview' 
                          : session.type === 'systemDesign' 
                            ? 'System Design Interview' 
                            : 'API Design Interview'
                      }</h3>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">
                      {new Date(session.date).toLocaleDateString()} at {new Date(session.date).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center">
                    {session.evaluation && (
                      <div className="text-sm mr-4">
                        <span className="text-neutral-600">Score: </span>
                        <span className={`font-medium ${
                          session.evaluation.overallScore >= 8 
                            ? 'text-success-700' 
                            : session.evaluation.overallScore >= 5 
                              ? 'text-warning-700' 
                              : 'text-error-700'
                        }`}>
                          {session.evaluation.overallScore}/10
                        </span>
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-neutral-400" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface InterviewTypeCardProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  color: 'primary' | 'secondary' | 'accent';
  onClick: () => void;
}

const InterviewTypeCard = ({ title, icon, description, color, onClick }: InterviewTypeCardProps) => {
  return (
    <motion.div 
      className="card bg-white hover:shadow-md transition-shadow cursor-pointer"
      whileHover={{ y: -4 }}
      onClick={onClick}
    >
      <div className="flex items-center mb-3">
        <div className={`w-12 h-12 rounded-full bg-${color}-100 flex items-center justify-center`}>
          {icon}
        </div>
        <h3 className="ml-3 font-medium text-lg">{title}</h3>
      </div>
      
      <p className="text-neutral-600 text-sm mb-4">{description}</p>
      
      <button 
        className={`btn btn-${color} w-full mt-auto`}
        onClick={onClick}
      >
        Start Practice
      </button>
    </motion.div>
  );
};

export default InterviewPrep;