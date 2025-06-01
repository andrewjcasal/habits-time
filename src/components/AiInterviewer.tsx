import { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Clock, Download } from 'lucide-react';
import { motion } from 'framer-motion';

// Types
import { InterviewSession, Message } from '../types';

// Utils
import { generateInterviewPrompts } from '../utils/interviewPrompts';

interface AiInterviewerProps {
  session: InterviewSession;
  onEndSession: (evaluation: any) => void;
}

export const AiInterviewer = ({ session, onEndSession }: AiInterviewerProps) => {
  const [messages, setMessages] = useState<Message[]>(session.messages || []);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [evaluation, setEvaluation] = useState(session.evaluation || null);
  const [showPromptSection, setShowPromptSection] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Generate interview prompts based on job description
  const prompts = generateInterviewPrompts(session.type, session.jobDescription);
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0] || '');
  
  // Initialize with the AI interviewer's greeting
  useEffect(() => {
    if (messages.length === 0) {
      const initialMessage: Message = {
        id: Date.now(),
        sender: 'ai',
        content: `Hello! I'll be your ${
          session.type === 'coding' 
            ? 'coding interview' 
            : session.type === 'systemDesign' 
              ? 'system design interview' 
              : 'API design interview'
        } practice partner today. We'll be working on the following problem:\n\n"${selectedPrompt}"\n\nWhen you're ready, please start by explaining your approach. Take your time, and don't hesitate to ask questions if you need clarification.`,
        timestamp: Date.now()
      };
      
      setMessages([initialMessage]);
      simulateTyping();
    }
    
    // Start the timer
    const intervalId = setInterval(() => {
      if (isActive) {
        setTimer(prevTimer => prevTimer + 1);
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [isActive, messages.length, selectedPrompt, session.type]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const simulateTyping = () => {
    setIsTyping(true);
    
    // Simulate typing delay
    setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };
  
  const handleSendMessage = () => {
    if (input.trim() === '') return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now(),
      sender: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    
    // Simulate AI response
    simulateTyping();
    
    // Check if we should end the interview
    if (input.toLowerCase().includes('end interview') || updatedMessages.length >= 15) {
      setTimeout(() => {
        const aiMessage: Message = {
          id: Date.now() + 1,
          sender: 'ai',
          content: "Let's wrap up this interview session. I'll now provide you with feedback on your performance.",
          timestamp: Date.now() + 1
        };
        
        setMessages([...updatedMessages, aiMessage]);
        setIsActive(false);
        
        // Generate evaluation
        const newEvaluation = generateEvaluation(session.type, updatedMessages);
        setEvaluation(newEvaluation);
        setShowEvaluation(true);
        onEndSession(newEvaluation);
      }, 2500);
    } else {
      // Generate regular AI response
      setTimeout(() => {
        const aiMessage: Message = {
          id: Date.now() + 1,
          sender: 'ai',
          content: generateAiResponse(input, session.type, updatedMessages.length),
          timestamp: Date.now() + 1
        };
        
        setMessages([...updatedMessages, aiMessage]);
      }, 2500);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handlePromptChange = (prompt: string) => {
    setSelectedPrompt(prompt);
    
    const promptChangeMessage: Message = {
      id: Date.now(),
      sender: 'system',
      content: `Interview problem changed to: "${prompt}"`,
      timestamp: Date.now()
    };
    
    setMessages([...messages, promptChangeMessage]);
    
    // Add AI message with new problem
    setTimeout(() => {
      const aiMessage: Message = {
        id: Date.now() + 1,
        sender: 'ai',
        content: `Let's work on this new problem:\n\n"${prompt}"\n\nWhen you're ready, please start by explaining your approach.`,
        timestamp: Date.now() + 1
      };
      
      setMessages([...messages, promptChangeMessage, aiMessage]);
    }, 1000);
  };
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  return (
    <div className="flex flex-col h-[75vh] card bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
        <div>
          <h2 className="font-medium">{
            session.type === 'coding'
              ? 'Coding Interview'
              : session.type === 'systemDesign'
                ? 'System Design Interview'
                : 'API Design Interview'
          }</h2>
          <div className="flex items-center text-sm text-neutral-500">
            <Clock className="h-3 w-3 mr-1" />
            <span>{formatTime(timer)}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {evaluation && (
            <button
              onClick={() => setShowEvaluation(!showEvaluation)}
              className="btn btn-outline !py-1 !px-2 text-xs"
            >
              {showEvaluation ? 'Hide' : 'Show'} Evaluation
            </button>
          )}
          
          <button
            onClick={() => setShowPromptSection(!showPromptSection)}
            className="btn btn-outline !py-1 !px-2"
          >
            {showPromptSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      {/* Problem selection */}
      {showPromptSection && (
        <div className="bg-neutral-50 p-4 border-b border-neutral-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Interview Problem</h3>
            <button
              onClick={() => {
                // Generate a new set of prompts
                const newPrompts = generateInterviewPrompts(session.type, session.jobDescription, true);
                setSelectedPrompt(newPrompts[0]);
                handlePromptChange(newPrompts[0]);
              }}
              className="text-xs text-primary-600 hover:text-primary-800"
            >
              Generate New
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {prompts.map((prompt, index) => (
              <div 
                key={index}
                className={`p-2 text-xs rounded-md cursor-pointer border ${
                  selectedPrompt === prompt
                    ? 'border-primary-500 bg-primary-50 text-primary-800'
                    : 'border-neutral-200 hover:bg-neutral-100'
                }`}
                onClick={() => handlePromptChange(prompt)}
              >
                {prompt}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Evaluation panel */}
      {showEvaluation && evaluation && (
        <div className="bg-neutral-50 p-4 border-b border-neutral-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Interview Evaluation</h3>
            <button className="text-xs text-primary-600 hover:text-primary-800 flex items-center">
              <Download className="h-3 w-3 mr-1" />
              Export
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {Object.keys(evaluation.scores).map((category) => (
              <div key={category} className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-xs text-neutral-500">{category}</p>
                <div className="flex items-center mt-1">
                  <div className="h-2 flex-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        evaluation.scores[category] >= 8 
                          ? 'bg-success-500' 
                          : evaluation.scores[category] >= 5 
                            ? 'bg-warning-500' 
                            : 'bg-error-500'
                      }`}
                      style={{ width: `${evaluation.scores[category] * 10}%` }}
                    />
                  </div>
                  <span className="ml-2 text-sm font-medium">{evaluation.scores[category]}/10</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-white p-3 rounded-md shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Overall Assessment</p>
              <span className={`text-sm font-medium ${
                evaluation.overallScore >= 8 
                  ? 'text-success-700' 
                  : evaluation.overallScore >= 5 
                    ? 'text-warning-700' 
                    : 'text-error-500'
              }`}>
                {evaluation.overallScore}/10
              </span>
            </div>
            <p className="text-sm text-neutral-600">{evaluation.feedback}</p>
          </div>
        </div>
      )}
      
      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-neutral-50">
        <div className="space-y-4">
          {messages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.sender === 'system' ? (
                <div className="bg-neutral-200 text-neutral-800 rounded-md py-2 px-3 max-w-xs md:max-w-md lg:max-w-lg text-sm">
                  {message.content}
                </div>
              ) : (
                <div 
                  className={`rounded-md py-3 px-4 max-w-xs md:max-w-md lg:max-w-lg ${
                    message.sender === 'user' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white text-neutral-800 border border-neutral-200'
                  }`}
                >
                  <div className="text-sm whitespace-pre-line">{message.content}</div>
                  <div className={`text-xs mt-1 text-right ${
                    message.sender === 'user' ? 'text-primary-200' : 'text-neutral-400'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white text-neutral-800 rounded-md py-2 px-4 border border-neutral-200">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse"></div>
                  <div className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse delay-100"></div>
                  <div className="h-2 w-2 rounded-full bg-neutral-400 animate-pulse delay-200"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-t border-neutral-200 bg-white">
        <div className="flex space-x-2">
          <textarea
            placeholder="Type your response..."
            className="input !h-12 flex-1 resize-none"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isActive === false}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isActive === false}
            className="btn btn-primary !px-3"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mt-2 text-xs text-neutral-500 flex items-center justify-between">
          <span>Type 'end interview' at any time to finish the session and get feedback.</span>
          
          {isActive === false && (
            <button
              onClick={() => onEndSession(evaluation)}
              className="btn btn-outline btn-sm"
            >
              Close Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to generate AI responses
const generateAiResponse = (userInput: string, interviewType: InterviewType, messageCount: number): string => {
  // Simple response generation based on interview type and context
  // In a real app, this would use a more sophisticated approach
  
  const commonResponses = [
    "That's a good approach. Could you elaborate on the time and space complexity?",
    "I see your point. Have you considered any edge cases?",
    "That's interesting. How would you scale this solution?",
    "Good explanation. How would you test this?",
    "Can you walk me through your thought process in more detail?"
  ];
  
  // Questions specific to interview type
  const typeSpecificResponses = {
    coding: [
      "How would you optimize this algorithm further?",
      "What data structures are you using and why?",
      "Can you write pseudocode for this approach?",
      "Are there any performance bottlenecks in your solution?",
      "How would you handle invalid inputs?"
    ],
    systemDesign: [
      "How would you handle system failures?",
      "What databases would you use and why?",
      "How would you design the API layer?",
      "Can you draw out the system architecture?",
      "How would you ensure the system is scalable?"
    ],
    apiDesign: [
      "What authentication mechanism would you use?",
      "How would you version your API?",
      "How would you handle rate limiting?",
      "What status codes would you return for different scenarios?",
      "How would you document this API?"
    ]
  };
  
  // If it's a question about clarification
  if (userInput.toLowerCase().includes('question') || userInput.endsWith('?')) {
    return "That's a good question. " + [
      "In this problem, we can assume that all inputs are valid.",
      "You should consider the most efficient solution possible.",
      "Yes, you can use any standard libraries or data structures.",
      "The system should be able to handle high traffic loads.",
      "Yes, security and data privacy are important considerations."
    ][Math.floor(Math.random() * 5)];
  }
  
  // If it's near the end, provide some wrap-up questions
  if (messageCount > 10) {
    return [
      "We're almost out of time. Can you summarize your approach and its trade-offs?",
      "Before we wrap up, do you have any questions about the problem or your solution?",
      "That looks good. If you had more time, what improvements would you make?",
      "Let's conclude here. Is there anything else you'd like to add?",
      "Thanks for walking me through your solution. Do you have any final thoughts?"
    ][Math.floor(Math.random() * 5)];
  }
  
  // Otherwise, mix common and type-specific responses
  const allResponses = [
    ...commonResponses,
    ...typeSpecificResponses[interviewType]
  ];
  
  return allResponses[Math.floor(Math.random() * allResponses.length)];
};

// Helper function to generate evaluation
const generateEvaluation = (interviewType: InterviewType, messages: Message[]) => {
  // In a real application, this would be a more sophisticated evaluation
  // based on actual AI analysis of the conversation
  
  // Simulate scores for different categories
  const getRandomScore = (min: number, max: number) => 
    Math.floor(Math.random() * (max - min + 1)) + min;
  
  const baseScores = {
    'Problem Understanding': getRandomScore(6, 9),
    'Communication': getRandomScore(5, 9),
    'Technical Knowledge': getRandomScore(6, 10)
  };
  
  let typeSpecificScores = {};
  
  // Add category-specific scores
  if (interviewType === 'coding') {
    typeSpecificScores = {
      'Algorithm Efficiency': getRandomScore(5, 9),
      'Code Quality': getRandomScore(6, 9)
    };
  } else if (interviewType === 'systemDesign') {
    typeSpecificScores = {
      'System Architecture': getRandomScore(5, 9),
      'Scalability': getRandomScore(5, 9)
    };
  } else {
    typeSpecificScores = {
      'API Design': getRandomScore(5, 9),
      'Security & Error Handling': getRandomScore(6, 9)
    };
  }
  
  const scores = {
    ...baseScores,
    ...typeSpecificScores
  };
  
  // Calculate overall score
  const overallScore = Math.round(
    Object.values(scores).reduce((sum: any, score: any) => sum + score, 0) / Object.keys(scores).length
  );
  
  // Generate feedback based on overall score
  let feedback = '';
  if (overallScore >= 8) {
    feedback = "Excellent performance! You demonstrated strong technical knowledge and communicated your thoughts clearly. Your approach to the problem was well-structured and efficient. A few minor improvements could be made in edge case handling, but overall this was a very strong interview.";
  } else if (overallScore >= 6) {
    feedback = "Good performance. You showed solid technical fundamentals and were able to solve the core problem. Your communication was clear, though could be more concise at times. Consider practicing more complex scenarios to improve your problem-solving speed and efficiency.";
  } else {
    feedback = "You have a good foundation, but need more practice. Focus on improving your problem analysis and breaking down complex problems into smaller parts. Work on communicating your thought process more clearly and consider edge cases earlier in your solution.";
  }
  
  return {
    scores,
    overallScore,
    feedback
  };
};