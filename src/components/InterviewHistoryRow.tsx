import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface InterviewHistoryRowProps {
  company: string
  position: string
  interviews: string[]
  readinessScore: number
}

// Individual Interview Pill Component
const InterviewPill = ({
  interview,
  readinessScore,
}: {
  interview: string
  readinessScore: number
}) => {
  const [showPopover, setShowPopover] = useState(false)

  const getInterviewTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'behavioral':
        return 'bg-blue-100 text-blue-800'
      case 'technical':
        return 'bg-purple-100 text-purple-800'
      case 'system design':
        return 'bg-green-100 text-green-800'
      case 'api design':
        return 'bg-orange-100 text-orange-800'
      case 'coding':
        return 'bg-indigo-100 text-indigo-800'
      case 'react ui':
        return 'bg-cyan-100 text-cyan-800'
      case 'react fundamentals':
        return 'bg-emerald-100 text-emerald-800'
      case 'design patterns':
        return 'bg-violet-100 text-violet-800'
      case 'collaboration':
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-neutral-100 text-neutral-800'
    }
  }

  const getReadinessLevel = (score: number) => {
    if (score >= 85)
      return {
        level: 'Excellent',
        color: 'text-success-600',
        bgColor: 'bg-success-50',
      }
    if (score >= 75)
      return {
        level: 'Good',
        color: 'text-warning-600',
        bgColor: 'bg-warning-50',
      }
    if (score >= 65)
      return {
        level: 'Fair',
        color: 'text-warning-600',
        bgColor: 'bg-warning-50',
      }
    return {
      level: 'Needs Work',
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    }
  }

  const getInterviewSpecificScore = (type: string, baseScore: number) => {
    // Simulate different readiness scores for different interview types
    const variations = {
      behavioral: -5,
      technical: 0,
      'system design': -3,
      'api design': 2,
      coding: -2,
      'react ui': 1,
      'react fundamentals': -1,
      'design patterns': 3,
      collaboration: -4,
    }

    const variation = variations[type.toLowerCase() as keyof typeof variations] || 0
    return Math.max(0, Math.min(100, baseScore + variation))
  }

  const getInterviewSpecificDetails = (type: string) => {
    const details = {
      behavioral: {
        preparation: 'Strong',
        experience: 'Excellent',
        confidence: 'Good',
      },
      technical: {
        preparation: 'Strong',
        experience: 'Good',
        confidence: 'Strong',
      },
      'system design': {
        preparation: 'Good',
        experience: 'Good',
        confidence: 'Fair',
      },
      'api design': {
        preparation: 'Excellent',
        experience: 'Strong',
        confidence: 'Strong',
      },
      coding: {
        preparation: 'Strong',
        experience: 'Strong',
        confidence: 'Good',
      },
      'react ui': {
        preparation: 'Excellent',
        experience: 'Strong',
        confidence: 'Excellent',
      },
      'react fundamentals': {
        preparation: 'Good',
        experience: 'Good',
        confidence: 'Good',
      },
      'design patterns': {
        preparation: 'Excellent',
        experience: 'Strong',
        confidence: 'Strong',
      },
      collaboration: {
        preparation: 'Good',
        experience: 'Fair',
        confidence: 'Good',
      },
    }

    return (
      details[type.toLowerCase() as keyof typeof details] || {
        preparation: 'Good',
        experience: 'Good',
        confidence: 'Good',
      }
    )
  }

  const specificScore = getInterviewSpecificScore(interview, readinessScore)
  const readiness = getReadinessLevel(specificScore)
  const details = getInterviewSpecificDetails(interview)

  return (
    <div className="relative">
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-all hover:scale-105 ${getInterviewTypeColor(
          interview
        )}`}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
      >
        {interview}
      </span>

      {/* Interview-Specific Popover */}
      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 p-4"
            style={{ zIndex: 1000 }}
          >
            <div className="space-y-3">
              <div>
                <h5 className="font-medium text-neutral-900">{interview} Readiness</h5>
                <p className="text-xs text-neutral-600 mt-1">
                  Your preparation level for this interview type
                </p>
              </div>

              <div className={`p-3 rounded-lg ${readiness.bgColor}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${readiness.color}`}>{readiness.level}</span>
                  <span className={`text-sm ${readiness.color}`}>{specificScore}%</span>
                </div>
                <div className="mt-2 bg-white bg-opacity-50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      specificScore >= 85
                        ? 'bg-success-500'
                        : specificScore >= 75
                          ? 'bg-warning-500'
                          : specificScore >= 65
                            ? 'bg-warning-500'
                            : 'bg-error-500'
                    }`}
                    style={{ width: `${specificScore}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-neutral-600">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Preparation:</span>
                    <span className="font-medium">{details.preparation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Experience:</span>
                    <span className="font-medium">{details.experience}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence:</span>
                    <span className="font-medium">{details.confidence}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const InterviewHistoryRow = ({
  company,
  position,
  interviews,
  readinessScore,
}: InterviewHistoryRowProps) => {
  return (
    <div className="p-4 hover:bg-neutral-50 transition-colors">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-neutral-900">{company}</h4>
            <p className="text-sm text-neutral-600">{position}</p>
          </div>
        </div>

        {/* Interview Types - Horizontal List with Individual Popovers */}
        <div className="flex flex-wrap gap-2">
          {interviews.map((interview, index) => (
            <InterviewPill key={index} interview={interview} readinessScore={readinessScore} />
          ))}
        </div>
      </div>
    </div>
  )
}
