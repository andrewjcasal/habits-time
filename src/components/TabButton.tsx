interface TabButtonProps {
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}

const TabButton = ({ isActive, onClick, children, className = '' }: TabButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-sm font-medium transition-colors relative ${
        isActive
          ? 'text-neutral-900 border-b-2 border-slate-500'
          : 'text-neutral-600 hover:text-neutral-900'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export default TabButton
