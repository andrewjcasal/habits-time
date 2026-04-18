import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalWrapperProps {
  isOpen: boolean
  onClose: () => void
  /** Rendered in the header row. Pass a string for the default styling, or
   *  any ReactNode when you need inline-editable headings, icons, back
   *  buttons, etc. Ignored in `bare` mode. */
  title?: ReactNode
  children: ReactNode
  headerActions?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Override the default body padding (`p-2`). Pass `'p-0'` to opt out
   *  entirely, or any Tailwind padding string. */
  contentClassName?: string
  /** When true, hides ModalWrapper's built-in header so the caller can
   *  provide a fully custom one via `children`. */
  hideHeader?: boolean
  /** When true, ModalWrapper only renders the backdrop (click-outside +
   *  Escape + maxWidth centering) — the caller supplies its own card
   *  chrome via `children`. Useful for modals with custom headers or
   *  scroll behavior that doesn't fit the default shell. */
  bare?: boolean
}

const ModalWrapper = ({
  isOpen,
  onClose,
  title,
  children,
  headerActions,
  maxWidth = 'md',
  contentClassName,
  hideHeader = false,
  bare = false,
}: ModalWrapperProps) => {
  // Escape-to-close. Only active while the modal is open so we don't steal
  // the key from other modals / inputs.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[maxWidth]

  if (bare) {
    return (
      <div
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className={`w-full mx-4 ${maxWidthClass}`}>{children}</div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`overflow-hidden rounded-lg w-full mx-4 ${maxWidthClass}`}>
        <div className={`bg-white rounded-lg ${contentClassName ?? 'p-2'}`}>
          {!hideHeader && (
            <div className="flex items-center justify-between mb-1">
              {typeof title === 'string' ? (
                <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
              ) : (
                <div className="min-w-0 flex-1 mr-2">{title}</div>
              )}
              <div className="flex items-center gap-1">
                {headerActions}
                <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

export default ModalWrapper