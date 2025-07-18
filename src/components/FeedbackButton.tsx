import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import FeedbackModal from './FeedbackModal'

const FeedbackButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-primary-600 hover:bg-primary-700 text-white rounded-full p-1.5 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        title="Send Feedback"
      >
        <MessageCircle className="w-3 h-3" />
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}

export default FeedbackButton