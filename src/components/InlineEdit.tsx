import { useRef, useEffect } from 'react'
import { Check, X } from 'lucide-react'

interface InlineEditField {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  className?: string
  min?: string
}

interface InlineEditProps {
  fields: InlineEditField[]
  onSave: () => void
  onCancel: () => void
}

export default function InlineEdit({ fields, onSave, onCancel }: InlineEditProps) {
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSave()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="flex items-center gap-1">
      {fields.map((field, i) => (
        <input
          key={i}
          ref={i === 0 ? firstRef : undefined}
          type={field.type || 'text'}
          value={field.value}
          onChange={e => field.onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={field.placeholder}
          min={field.min}
          className={field.className || 'text-sm text-neutral-800 bg-transparent border-b border-primary-500 outline-none flex-1 min-w-0'}
        />
      ))}
      <button
        onClick={onSave}
        className="p-0.5 text-green-600 hover:text-green-800 transition-colors"
        title="Save"
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        onClick={onCancel}
        className="p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors"
        title="Cancel"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
