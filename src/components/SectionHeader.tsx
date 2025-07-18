import AddButton from './AddButton'

interface SectionHeaderProps {
  title: string
  onAddClick: () => void
  className?: string
}

const SectionHeader = ({ title, onAddClick, className = '' }: SectionHeaderProps) => {
  return (
    <div className={`px-2 py-1 flex items-center justify-between ${className}`}>
      <h3 className="text-md font-medium text-neutral-900">{title}</h3>
      <AddButton onClick={onAddClick} />
    </div>
  )
}

export default SectionHeader
