import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'

interface WelcomeModalProps {
  onClose: () => void
}

export const WelcomeModal = ({ onClose }: WelcomeModalProps) => {
  const [step, setStep] = useState(0)

  const steps = [
    {
      title: 'Welcome to Cassian',
      description:
        'Your comprehensive productivity platform for managing time, habits, and projects with intelligent scheduling.',
      image:
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop&crop=center',
    },
    {
      title: 'Smart Calendar & Time Tracking',
      description:
        'Visualize your day with automated task scheduling, habit tracking, and meeting management that adapts to your workflow.',
      image:
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&crop=center',
    },
    {
      title: 'Build Better Habits',
      description:
        'Create sustainable routines with daily habit tracking, morning and evening rituals, and progress insights.',
      image:
        'https://images.unsplash.com/photo-1434626881859-194d67b2b86f?w=800&h=600&fit=crop&crop=center',
    },
    {
      title: 'Project & Task Management',
      description:
        'Organize your work with project timelines, task prioritization, and automatic scheduling based on your availability.',
      image:
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop&crop=center',
    },
  ]

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      onClose()
    }
  }

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
              <h2 className="text-2xl font-semibold text-neutral-900 mb-3">{steps[step].title}</h2>
              <p className="text-neutral-600">{steps[step].description}</p>
            </motion.div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(step - 1)}
                disabled={step === 0}
                className="btn btn-outline !px-3 disabled:opacity-0"
              >
                Back
              </button>

              <button onClick={handleNext} className="btn btn-primary">
                {step === steps.length - 1 ? 'Get Started' : 'Next'}
                <ChevronRight className="ml-1 w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
