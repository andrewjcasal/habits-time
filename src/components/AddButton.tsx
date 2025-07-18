import { Plus } from 'lucide-react'

interface AddButtonProps {
  onClick: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const AddButton = ({ onClick, className = '', size = 'md' }: AddButtonProps) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <button
      onClick={onClick}
      className={`text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded-md transition-colors ${className}`}
    >
      <Plus className={sizeClasses[size]} />
    </button>
  )
}

export default AddButton