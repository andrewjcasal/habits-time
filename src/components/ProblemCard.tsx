import { useState } from 'react'
import { Check, ExternalLink, Clock, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

// Types
import { Problem, SPACED_REP_LEVELS } from '../types'

interface ProblemCardProps {
  problem: Problem
  onClick: () => void
  onStatusChange: (id: number, completed: boolean) => void
  isSelected: boolean
}

const ProblemCard = ({ problem, onClick, onStatusChange, isSelected }: ProblemCardProps) => {
  const [isHovered, setIsHovered] = useState(false)

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStatusChange(problem.id, !problem.completed)
  }

  const getReviewStatus = () => {
    if (!problem.nextReview) return null

    const now = Date.now()
    const daysUntilReview = Math.ceil((problem.nextReview - now) / (1000 * 60 * 60 * 24))

    if (daysUntilReview <= 0) {
      return {
        text: 'Due for review',
        color: 'text-warning-600 bg-warning-50',
      }
    }

    return {
      text: `Review in ${daysUntilReview} day${daysUntilReview > 1 ? 's' : ''}`,
      color: 'text-neutral-600 bg-neutral-50',
    }
  }

  const reviewStatus = getReviewStatus()

  return (
    <motion.div
      className={`card bg-white hover:shadow-md transition-all cursor-pointer ${
        isSelected ? 'ring-2 ring-primary-500' : ''
      }`}
      whileHover={{ y: -2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="flex justify-between">
        <div className="flex-1 mr-3">
          <div className="flex items-start justify-between">
            <h3 className="font-medium text-neutral-900">{problem.title}</h3>

            <button
              onClick={handleStatusClick}
              className={`h-5 w-5 flex-shrink-0 rounded-full ${
                problem.completed ? 'bg-primary-500 text-white' : 'border border-neutral-300'
              }`}
            >
              {problem.completed && <Check className="h-3 w-3 mx-auto" />}
            </button>
          </div>

          <div className="flex items-center mt-1">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 ${
                problem.difficulty === 'Easy'
                  ? 'bg-success-500'
                  : problem.difficulty === 'Medium'
                    ? 'bg-warning-500'
                    : 'bg-error-500'
              }`}
            />
            <span className="text-sm text-neutral-600">{problem.difficulty}</span>

            {problem.level > 0 && (
              <>
                <span className="mx-2 text-neutral-300">•</span>
                <span className="text-sm text-primary-600">Level {problem.level}</span>
              </>
            )}
          </div>

          <p className="text-xs text-neutral-500 mt-2">{problem.category}</p>
        </div>
      </div>

      {problem.url && isHovered && (
        <motion.div
          className="mt-3 text-sm text-primary-600 hover:text-primary-700"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View on LeetCode
          </a>
        </motion.div>
      )}

      {/* Review status indicator */}
      {reviewStatus && (
        <div className={`mt-3 text-xs ${reviewStatus.color} p-1 rounded flex items-center`}>
          {problem.nextReview && problem.nextReview <= Date.now() ? (
            <AlertCircle className="h-3 w-3 mr-1" />
          ) : (
            <Clock className="h-3 w-3 mr-1" />
          )}
          {reviewStatus.text}
        </div>
      )}
    </motion.div>
  )
}

export default ProblemCard
