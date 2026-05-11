import { useEffect, useMemo, useState } from 'react'
import { Target, Check } from 'lucide-react'
import { Project } from '../types'
import { supabase } from '../lib/supabase'

interface CommitmentsPanelProps {
  selectedProject: Project
  /** Same handler used by ProjectSettingsModal — patches a project row
   *  and updates parent state in place (no refetch). */
  onUpdateProject?: (projectId: string, data: any) => Promise<void>
}

interface ActivityRow {
  start_time: string
  end_time: string
}

const startOfWeek = (d: Date): Date => {
  // Sunday-anchored week. Adjust if the rest of the app uses Monday.
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay())
  return out
}

const durationHours = (start: string, end: string): number => {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0
  return (e - s) / (1000 * 60 * 60)
}

export default function CommitmentsPanel({
  selectedProject,
  onUpdateProject,
}: CommitmentsPanelProps) {
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [totalInput, setTotalInput] = useState<string>('')
  const [weeklyInput, setWeeklyInput] = useState<string>('')

  useEffect(() => {
    setTotalInput(
      selectedProject.commitment_total_hours != null
        ? String(selectedProject.commitment_total_hours)
        : ''
    )
    setWeeklyInput(
      selectedProject.commitment_weekly_hours != null
        ? String(selectedProject.commitment_weekly_hours)
        : ''
    )
  }, [selectedProject.id, selectedProject.commitment_total_hours, selectedProject.commitment_weekly_hours])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('cassian_project_activity')
        .select('start_time, end_time')
        .eq('project_id', selectedProject.id)
      if (!cancelled) setActivity(data || [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedProject.id])

  const { totalHours, weekHours } = useMemo(() => {
    const weekStart = startOfWeek(new Date()).getTime()
    let total = 0
    let week = 0
    for (const a of activity) {
      const dur = durationHours(a.start_time, a.end_time)
      total += dur
      if (new Date(a.start_time).getTime() >= weekStart) week += dur
    }
    return { totalHours: total, weekHours: week }
  }, [activity])

  const [saving, setSaving] = useState(false)

  const parseInput = (raw: string): number | null | 'invalid' => {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const parsed = parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : 'invalid'
  }

  const dirty = useMemo(() => {
    const t = parseInput(totalInput)
    const w = parseInput(weeklyInput)
    if (t === 'invalid' || w === 'invalid') return false
    return (
      t !== (selectedProject.commitment_total_hours ?? null) ||
      w !== (selectedProject.commitment_weekly_hours ?? null)
    )
  }, [totalInput, weeklyInput, selectedProject.commitment_total_hours, selectedProject.commitment_weekly_hours])

  const handleSave = async () => {
    if (!onUpdateProject || !dirty) return
    const t = parseInput(totalInput)
    const w = parseInput(weeklyInput)
    if (t === 'invalid' || w === 'invalid') return
    setSaving(true)
    try {
      await onUpdateProject(selectedProject.id, {
        commitment_total_hours: t,
        commitment_weekly_hours: w,
      })
    } catch (err) {
      console.error('Failed to update commitments:', err)
    } finally {
      setSaving(false)
    }
  }

  const totalCommitted = selectedProject.commitment_total_hours ?? null
  const weeklyCommitted = selectedProject.commitment_weekly_hours ?? null
  const totalPct =
    totalCommitted && totalCommitted > 0 ? Math.min(100, (totalHours / totalCommitted) * 100) : 0
  const weeklyPct =
    weeklyCommitted && weeklyCommitted > 0 ? Math.min(100, (weekHours / weeklyCommitted) * 100) : 0

  return (
    <div className="w-64 flex-shrink-0 border-r border-neutral-200 bg-white p-2 overflow-y-auto">
      <div className="flex items-center gap-1 mb-2">
        <Target className="w-2 h-2 text-neutral-500" />
        <h3 className="text-xs font-medium text-neutral-900">Commitments</h3>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-xs text-neutral-600 mb-0.5">Total time</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.25"
              value={totalInput}
              onChange={e => setTotalInput(e.target.value)}
              className="w-16 px-1 py-0.5 border border-neutral-300 rounded text-xs"
              placeholder="—"
            />
            <span className="text-xs text-neutral-500">h</span>
            {totalCommitted != null && (
              <span className="text-xs text-neutral-700 ml-auto font-medium">
                {totalHours.toFixed(1)} / {totalCommitted}h
              </span>
            )}
          </div>
          {totalCommitted != null && (
            <div className="mt-1 h-1 bg-neutral-100 rounded overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${totalPct}%` }} />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-neutral-600 mb-0.5">This week</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.25"
              value={weeklyInput}
              onChange={e => setWeeklyInput(e.target.value)}
              className="w-16 px-1 py-0.5 border border-neutral-300 rounded text-xs"
              placeholder="—"
            />
            <span className="text-xs text-neutral-500">h</span>
            {weeklyCommitted != null && (
              <span className="text-xs text-neutral-700 ml-auto font-medium">
                {weekHours.toFixed(1)} / {weeklyCommitted}h
              </span>
            )}
          </div>
          {weeklyCommitted != null && (
            <div className="mt-1 h-1 bg-neutral-100 rounded overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${weeklyPct}%` }} />
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-2 h-2" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
