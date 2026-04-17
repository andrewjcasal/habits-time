import { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'

interface HelpBreatheButtonProps {
  className?: string
  iconClassName?: string
}

export default function HelpBreatheButton({
  className = '',
  iconClassName = 'w-4 h-4',
}: HelpBreatheButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`rounded-full text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors ${className}`}
        title="Need help?"
        aria-label="Need help"
      >
        <AlertCircle className={iconClassName} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-neutral-700 rounded hover:bg-neutral-100"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <h2
              className="text-2xl text-neutral-900 text-center"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Need Help?
            </h2>
            <p className="text-sm text-neutral-600 text-center mt-1">
              Take a Deep Breath
            </p>

            {/* 4-4-4-4 box breathing: 4s inhale (expand), 4s hold, 4s exhale
                (collapse), 4s hold. 16s total cycle, linear timing so the
                expansion/contraction moves at a steady pace. */}
            <div className="mt-6 flex items-center justify-center" style={{ height: 200 }}>
              <div
                className="rounded-full bg-amber-200/60 border-2 border-amber-400"
                style={{
                  width: 160,
                  height: 160,
                  animation: 'cassian-box-breathe 16s linear infinite',
                }}
              />
            </div>

            <style>
              {`
                @keyframes cassian-box-breathe {
                  0%   { transform: scale(0.3); }
                  25%  { transform: scale(1); }
                  50%  { transform: scale(1); }
                  75%  { transform: scale(0.3); }
                  100% { transform: scale(0.3); }
                }
              `}
            </style>
          </div>
        </div>
      )}
    </>
  )
}
