import { useState } from 'react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'

// Types
import { InterviewType } from '../types'

interface InterviewFormProps {
  type: InterviewType
  onSubmit: (data: { jobDescription: string; additionalInfo: string }) => void
  onCancel: () => void
}

export const InterviewForm = ({ type, onSubmit, onCancel }: InterviewFormProps) => {
  const [jobDescription, setJobDescription] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ jobDescription, additionalInfo })
  }

  const getTitle = () => {
    switch (type) {
      case 'coding':
        return 'Coding Interview'
      case 'systemDesign':
        return 'System Design Interview'
      case 'apiDesign':
        return 'API Design Interview'
      default:
        return 'Interview Preparation'
    }
  }

  const getDescription = () => {
    switch (type) {
      case 'coding':
        return 'Practice solving coding problems with feedback on your approach, code quality, and communication.'
      case 'systemDesign':
        return 'Practice designing scalable systems and architectures for various requirements and constraints.'
      case 'apiDesign':
        return 'Practice designing RESTful APIs, GraphQL schemas, and other API patterns for various use cases.'
      default:
        return 'Prepare for your upcoming interview with personalized practice.'
    }
  }

  return (
    <motion.div
      className="card bg-white"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{getTitle()}</h2>
        <button onClick={onCancel} className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="text-neutral-600 mb-6">{getDescription()}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="jobDescription"
            className="block text-sm font-medium text-neutral-700 mb-1"
          >
            Job Description
          </label>
          <textarea
            id="jobDescription"
            placeholder="Paste the job description here to personalize your interview practice..."
            className="input !h-32 resize-none"
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="additionalInfo"
            className="block text-sm font-medium text-neutral-700 mb-1"
          >
            Additional Information (Optional)
          </label>
          <textarea
            id="additionalInfo"
            placeholder="Add any other information about the role, company, or specific areas you want to focus on..."
            className="input !h-20 resize-none"
            value={additionalInfo}
            onChange={e => setAdditionalInfo(e.target.value)}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>

          <button type="submit" className="btn btn-primary">
            Start Interview
          </button>
        </div>
      </form>
    </motion.div>
  )
}
