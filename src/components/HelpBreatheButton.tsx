import { useState, useEffect, useRef } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface HelpBreatheButtonProps {
  className?: string
  iconClassName?: string
}

type Step = 'reset' | 'breathe' | 'update'

interface HabitRow {
  id: string
  name: string
  current_start_time: string | null
}

export default function HelpBreatheButton({
  className = '',
  iconClassName = 'w-4 h-4',
}: HelpBreatheButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('reset')
  const [habits, setHabits] = useState<HabitRow[]>([])
  const [habitsLoaded, setHabitsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!open || habitsLoaded) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data } = await supabase
        .from('cassian_habits')
        .select('id, name, current_start_time')
        .eq('user_id', user.id)
        .eq('is_visible', true)
        .or('is_archived.eq.false,is_archived.is.null')
        .order('current_start_time', { ascending: true })
      if (cancelled) return
      setHabits((data as HabitRow[]) || [])
      setHabitsLoaded(true)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [open, habitsLoaded])

  const updateHabitTime = (habitId: string, timeHHmm: string) => {
    const valueForDb = timeHHmm ? `${timeHHmm}:00` : null
    setHabits(prev => prev.map(h => h.id === habitId ? { ...h, current_start_time: valueForDb } : h))
    if (saveTimers.current[habitId]) clearTimeout(saveTimers.current[habitId])
    saveTimers.current[habitId] = setTimeout(async () => {
      await supabase
        .from('cassian_habits')
        .update({ current_start_time: valueForDb })
        .eq('id', habitId)
    }, 400)
  }

  const close = () => {
    setOpen(false)
    setStep('reset')
  }

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
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-neutral-200">
              <h2
                className="text-xl text-neutral-900"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Need Help?
              </h2>
              <button
                onClick={close}
                className="p-1 text-neutral-500 hover:text-neutral-700 rounded hover:bg-neutral-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-stretch border-b border-neutral-200">
              <StepTab
                active={step === 'reset'}
                onClick={() => setStep('reset')}
                num={1}
                label="Reset"
              />
              <StepTab
                active={step === 'breathe'}
                onClick={() => setStep('breathe')}
                num={2}
                label="Breathe"
              />
              <StepTab
                active={step === 'update'}
                onClick={() => setStep('update')}
                num={3}
                label="Let's Update"
              />
            </div>

            {/* Content */}
            {step === 'reset' && <ResetContent />}
            {step === 'breathe' && <BreatheContent />}
            {step === 'update' && (
              <UpdateContent
                habits={habits}
                loading={loading && !habitsLoaded}
                onUpdate={updateHabitTime}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

interface StepTabProps {
  active: boolean
  onClick: () => void
  num: number
  label: string
}

function StepTab({ active, onClick, num, label }: StepTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm transition-colors border-b-2 ${
        active
          ? 'bg-amber-50 text-neutral-900 border-amber-500'
          : 'text-neutral-500 hover:bg-neutral-50 border-transparent'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium ${
          active ? 'bg-amber-500 text-white' : 'bg-neutral-200 text-neutral-600'
        }`}
      >
        {num}
      </span>
      <span>{label}</span>
    </button>
  )
}

function ResetContent() {
  return (
    <div className="p-6 text-center">
      <p
        className="text-2xl leading-snug text-neutral-900"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        It's ok to fall off.
      </p>
      <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
        Each version you've tried taught you something — now you get to build
        the next, and you'll be sharper for having tried.
      </p>
      <p
        className="mt-3 text-2xl leading-snug text-neutral-900"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        Let's jump back on again.
      </p>
    </div>
  )
}

function BreatheContent() {
  return (
    <div className="p-6">
      <p className="text-sm text-neutral-600 text-center">Take a Deep Breath</p>
      {/* 4-4-4-4 box breathing: 4s inhale, 4s hold, 4s exhale, 4s hold. */}
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
  )
}

interface UpdateContentProps {
  habits: HabitRow[]
  loading: boolean
  onUpdate: (habitId: string, timeHHmm: string) => void
}

function UpdateContent({ habits, loading, onUpdate }: UpdateContentProps) {
  if (loading) {
    return <div className="p-6 text-center text-sm text-neutral-500">Loading habits…</div>
  }
  if (habits.length === 0) {
    return <div className="p-6 text-center text-sm text-neutral-500">No habits yet.</div>
  }
  return (
    <div className="flex-1 overflow-y-auto p-2 min-h-0">
      <ul className="divide-y divide-neutral-100">
        {habits.map(habit => (
          <li
            key={habit.id}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <span className="flex-1 text-sm text-neutral-900 truncate">{habit.name}</span>
            <input
              type="time"
              value={habit.current_start_time ? habit.current_start_time.slice(0, 5) : ''}
              onChange={e => onUpdate(habit.id, e.target.value)}
              className="text-sm text-neutral-700 bg-white border border-neutral-200 rounded px-2 py-1 outline-none focus:border-amber-400"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
