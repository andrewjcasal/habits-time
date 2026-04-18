import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalWrapper from './ModalWrapper'

interface ArchivedHabit {
  id: string
  name: string
  duration: number | null
  current_start_time: string | null
  weekly_days: string[] | null
}

interface ArchivedHabitsModalProps {
  isOpen: boolean
  onClose: () => void
  onUnarchive: (habitId: string) => Promise<void>
}

const ArchivedHabitsModal = ({ isOpen, onClose, onUnarchive }: ArchivedHabitsModalProps) => {
  const [habits, setHabits] = useState<ArchivedHabit[]>([])
  const [loading, setLoading] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('cassian_habits')
        .select('id, name, duration, current_start_time, weekly_days')
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .is('parent_habit_id', null)
        .order('name', { ascending: true })
      if (cancelled) return
      setHabits((data as ArchivedHabit[]) || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [isOpen])

  const handleUnarchive = async (habit: ArchivedHabit) => {
    setWorkingId(habit.id)
    try {
      await onUnarchive(habit.id)
      setHabits(prev => prev.filter(h => h.id !== habit.id))
    } catch (err) {
      console.error('Error unarchiving habit:', err)
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Archived Habits" maxWidth="md">
      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-xs text-neutral-500 py-4 text-center">Loading…</p>
        ) : habits.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">No archived habits.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {habits.map(habit => (
              <li key={habit.id} className="flex items-center justify-between py-1.5 px-1">
                <div className="min-w-0">
                  <div className="text-sm text-neutral-900 truncate">{habit.name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {habit.current_start_time ? habit.current_start_time.slice(0, 5) : '—'}
                    {habit.duration ? ` · ${habit.duration}m` : ''}
                    {habit.weekly_days && habit.weekly_days.length > 0
                      ? ` · ${habit.weekly_days.map(d => d.slice(0, 3)).join(', ')}`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnarchive(habit)}
                  disabled={workingId === habit.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
                  title="Unarchive"
                >
                  <RotateCcw className="w-3 h-3" />
                  {workingId === habit.id ? 'Restoring…' : 'Unarchive'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalWrapper>
  )
}

export default ArchivedHabitsModal
