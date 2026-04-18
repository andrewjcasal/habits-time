import { useState, useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalWrapper from './ModalWrapper'

interface NeedHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

type View = 'menu' | 'reset' | 'breathe' | 'update'

const VIEW_LABELS: Record<Exclude<View, 'menu'>, string> = {
  reset: 'Reset',
  breathe: 'Breathe',
  update: "Let's Update",
}

interface HabitRow {
  id: string
  name: string
  current_start_time: string | null
}

export default function NeedHelpModal({ isOpen, onClose }: NeedHelpModalProps) {
  const [view, setView] = useState<View>('menu')
  const [habits, setHabits] = useState<HabitRow[]>([])
  const [habitsLoaded, setHabitsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Reset view to menu when the modal closes so next open starts fresh.
  useEffect(() => {
    if (!isOpen) setView('menu')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || habitsLoaded) return
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
  }, [isOpen, habitsLoaded])

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

  const titleNode = view === 'menu' ? (
    <h2
      className="text-xl text-neutral-900"
      style={{ fontFamily: "'DM Serif Display', serif" }}
    >
      Need Help?
    </h2>
  ) : (
    <button
      onClick={() => setView('menu')}
      className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
      aria-label="Back to menu"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span
        className="text-lg text-neutral-900"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        {VIEW_LABELS[view]}
      </span>
    </button>
  )

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={titleNode}
      maxWidth="md"
      contentClassName="p-0"
    >
      <div className="flex flex-col max-h-[85vh]">
        {view === 'menu' && <MenuView onSelect={setView} />}
        {view === 'reset' && <ResetContent />}
        {view === 'breathe' && <BreatheContent />}
        {view === 'update' && (
          <UpdateContent
            habits={habits}
            loading={loading && !habitsLoaded}
            onUpdate={updateHabitTime}
          />
        )}
      </div>
    </ModalWrapper>
  )
}

interface MenuViewProps {
  onSelect: (view: View) => void
}

function MenuView({ onSelect }: MenuViewProps) {
  return (
    <div className="p-4 space-y-2">
      <MenuButton
        num={1}
        label="Reset"
        onClick={() => onSelect('reset')}
        bg="bg-rose-100"
        bgHover="hover:bg-rose-200"
        text="text-rose-900"
        badgeBg="bg-rose-500"
      />
      <MenuButton
        num={2}
        label="Breathe"
        onClick={() => onSelect('breathe')}
        bg="bg-sky-100"
        bgHover="hover:bg-sky-200"
        text="text-sky-900"
        badgeBg="bg-sky-500"
      />
      <MenuButton
        num={3}
        label="Let's Update"
        onClick={() => onSelect('update')}
        bg="bg-amber-100"
        bgHover="hover:bg-amber-200"
        text="text-amber-900"
        badgeBg="bg-amber-500"
      />
    </div>
  )
}

interface MenuButtonProps {
  num: number
  label: string
  onClick: () => void
  bg: string
  bgHover: string
  text: string
  badgeBg: string
}

function MenuButton({ num, label, onClick, bg, bgHover, text, badgeBg }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${bg} ${bgHover} ${text} transition-colors text-left`}
    >
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium text-white flex-shrink-0 ${badgeBg}`}
      >
        {num}
      </span>
      <span className="text-base font-medium">{label}</span>
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
