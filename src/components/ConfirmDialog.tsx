import { X } from 'lucide-react'
import { motion } from 'framer-motion'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}: ConfirmDialogProps) => {
  if (!isOpen) return null

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg shadow-lg w-full max-w-md"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-neutral-600 mb-6">{message}</p>

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className="btn bg-error-600 hover:bg-error-700 text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
