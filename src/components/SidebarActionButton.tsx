import { ReactNode } from 'react'

interface SidebarActionButtonProps {
  onClick: () => void
  title: string
  children: ReactNode
}

const SidebarActionButton = ({ onClick, title, children }: SidebarActionButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-5 h-5 flex items-center justify-center bg-white hover:bg-neutral-50 rounded text-neutral-600 hover:text-neutral-800 transition-colors shadow-sm"
      title={title}
    >
      {children}
    </button>
  )
}

export default SidebarActionButton