import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalWrapperProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  rightSidebarActions?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

const ModalWrapper = ({
  isOpen,
  onClose,
  title,
  children,
  rightSidebarActions,
  maxWidth = 'md'
}: ModalWrapperProps) => {
  if (!isOpen) return null

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg'
  }[maxWidth]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`overflow-hidden rounded-lg w-full mx-4 ${maxWidthClass}`}>
        <div className="flex bg-neutral-100">
          {/* Main content area */}
          <div className="bg-white p-2 flex-1 rounded-r-lg">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-neutral-900">
                {title}
              </h2>
              <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-3 h-3" />
              </button>
            </div>
            {children}
          </div>
          
          {/* Right sidebar for actions */}
          {rightSidebarActions && (
            <div className="w-16 bg-neutral-100 py-3 px-1 rounded-r-lg">
              <div className="flex flex-col gap-1">
                {rightSidebarActions}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModalWrapper