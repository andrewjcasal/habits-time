import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

export const WelcomeModal = ({ onClose }: WelcomeModalProps) => {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: 'Welcome to FrontPrep',
      description: 'Your all-in-one interview preparation platform for front-end engineers.',
      image: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    },
    {
      title: 'Practice Coding Problems',
      description: 'Master the Neetcode 150 with our spaced repetition system for optimal retention.',
      image: 'https://images.pexels.com/photos/374016/pexels-photo-374016.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    },
    {
      title: 'Prepare for Interviews',
      description: 'Practice with our AI interviewer to improve your technical and communication skills.',
      image: 'https://images.pexels.com/photos/7654586/pexels-photo-7654586.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    },
    {
      title: 'Track Your Job Search',
      description: 'Keep track of applications, interviews, and networking contacts all in one place.',
      image: 'https://images.pexels.com/photos/7376/startup-photos.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    }
  ];
  
  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div 
        className="relative bg-white rounded-xl shadow-xl overflow-hidden max-w-2xl w-full mx-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-800 z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Progress indicators */}
        <div className="absolute top-4 left-0 right-0 flex justify-center space-x-1 z-10">
          {steps.map((_, index) => (
            <div 
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === step ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
        
        <div className="flex flex-col md:flex-row h-full">
          {/* Image */}
          <div className="w-full md:w-1/2 h-48 md:h-auto relative">
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent z-10" />
            <img 
              src={steps[step].image}
              alt={steps[step].title}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Content */}
          <div className="w-full md:w-1/2 p-6 flex flex-col">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <h2 className="text-2xl font-semibold text-neutral-900 mb-3">
                {steps[step].title}
              </h2>
              <p className="text-neutral-600">
                {steps[step].description}
              </p>
            </motion.div>
            
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(step - 1)}
                disabled={step === 0}
                className="btn btn-outline !px-3 disabled:opacity-0"
              >
                Back
              </button>
              
              <button
                onClick={handleNext}
                className="btn btn-primary"
              >
                {step === steps.length - 1 ? 'Get Started' : 'Next'}
                <ChevronRight className="ml-1 w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};