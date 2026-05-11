import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { BillableHour } from '../types'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface PastWindowEntry {
  start_time: string
  end_time: string
}

interface ConflictEntry {
  /** ISO-8601 timestamp. */
  start_time: string
  /** ISO-8601 timestamp. */
  end_time: string
  /** Display label for the conflict toast / error message. */
  title: string
}

interface UseBillableHoursOptions {
  /** Past `cassian_project_activity` rows (or any other source with
   *  start/end ISO strings) folded into `hoursBilledLast7Days`. */
  pastBilledExtras?: PastWindowEntry[]
  /** Existing meetings / habits / project_activity / etc. that a
   *  manual billable-hours add or update must not overlap with. The
   *  auto-placer doesn't go through this path; it uses
   *  `is_auto_placed: true` and is trusted to have already inverted
   *  these intervals. */
  conflictSources?: ConflictEntry[]
}

/** Thrown by `addBillableHour` / `updateBillableHour` when the requested
 *  interval overlaps a meeting / habit / project_activity / other
 *  billable-hour block. Carries the conflicting entry's title so the
 *  caller can surface a "Conflicts with <title>" toast. */
export class BillableHoursConflictError extends Error {
  conflictTitle: string
  constructor(conflictTitle: string) {
    super(`Conflicts with ${conflictTitle}`)
    this.name = 'BillableHoursConflictError'
    this.conflictTitle = conflictTitle
  }
}

const intervalsOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && bStart < aEnd

const findConflict = (
  startIso: string,
  endIso: string,
  sources: ConflictEntry[]
): ConflictEntry | null => {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  for (const entry of sources) {
    const entryStart = new Date(entry.start_time).getTime()
    const entryEnd = new Date(entry.end_time).getTime()
    if (!Number.isFinite(entryStart) || !Number.isFinite(entryEnd)) continue
    if (intervalsOverlap(start, end, entryStart, entryEnd)) return entry
  }
  return null
}

const durationHours = (startIso: string, endIso: string): number => {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return (end - start) / (1000 * 60 * 60)
}

export const useBillableHours = ({
  pastBilledExtras = [],
  conflictSources = [],
}: UseBillableHoursOptions = {}) => {
  const [billableHours, setBillableHours] = useState<BillableHour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Conflict sources can change every render (caller composes from
  // multiple arrays). Keep them in a ref so the mutator closures don't
  // capture a stale snapshot — without this, the conflict guard could
  // OK an interval based on the conflict sources at the time the
  // mutator was first defined.
  const conflictSourcesRef = useRef<ConflictEntry[]>(conflictSources)
  conflictSourcesRef.current = conflictSources

  const billableHoursRef = useRef<BillableHour[]>(billableHours)
  billableHoursRef.current = billableHours

  const fetchBillableHours = async () => {
    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      // Past-row cleanup lives in Calendar.tsx so it can convert
      // assigned blocks into project_activity before deletion (see
      // billable-to-activity rollover effect there).

      const { data, error } = await supabase
        .from('cassian_billable_hours')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true })

      if (error) {
        setError(error.message)
        return
      }
      setBillableHours(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBillableHours()
  }, [])

  const addBillableHour = async (
    input: {
      start_time: string
      end_time: string
      rate?: number
      note?: string | null
      is_auto_placed?: boolean
    }
  ): Promise<BillableHour> => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Manual creates and explicit auto-placed-false additions go
    // through the conflict guard; auto-placer batch inserts bypass
    // (they construct `appendBillableHours` rows directly, never call
    // this method).
    const otherBlocks = billableHoursRef.current.map(b => ({
      start_time: b.start_time,
      end_time: b.end_time,
      title: 'another billable block',
    }))
    const conflict = findConflict(input.start_time, input.end_time, [
      ...conflictSourcesRef.current,
      ...otherBlocks,
    ])
    if (conflict) throw new BillableHoursConflictError(conflict.title)

    const payload = {
      user_id: user.id,
      start_time: input.start_time,
      end_time: input.end_time,
      rate: input.rate ?? 100,
      note: input.note ?? null,
      is_auto_placed: input.is_auto_placed ?? true,
    }

    const { data, error } = await supabase
      .from('cassian_billable_hours')
      .insert([payload])
      .select()
      .single()

    if (error) throw error

    setBillableHours(prev =>
      [...prev, data as BillableHour].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
    )
    return data as BillableHour
  }

  const updateBillableHour = async (id: string, patch: Partial<BillableHour>): Promise<void> => {
    // If the patch shifts start_time or end_time, run the conflict
    // guard against the new interval. Other patches (rate, note,
    // is_auto_placed) skip the guard since they don't move the block.
    if (patch.start_time !== undefined || patch.end_time !== undefined) {
      const existing = billableHoursRef.current.find(b => b.id === id)
      if (existing) {
        const newStart = patch.start_time ?? existing.start_time
        const newEnd = patch.end_time ?? existing.end_time
        const otherBlocks = billableHoursRef.current
          .filter(b => b.id !== id)
          .map(b => ({
            start_time: b.start_time,
            end_time: b.end_time,
            title: 'another billable block',
          }))
        const conflict = findConflict(newStart, newEnd, [
          ...conflictSourcesRef.current,
          ...otherBlocks,
        ])
        if (conflict) throw new BillableHoursConflictError(conflict.title)
      }
    }

    const { data, error } = await supabase
      .from('cassian_billable_hours')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    setBillableHours(prev =>
      prev
        .map(b => (b.id === id ? (data as BillableHour) : b))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    )
  }

  const deleteBillableHour = async (id: string): Promise<void> => {
    const { error } = await supabase.from('cassian_billable_hours').delete().eq('id', id)
    if (error) throw error
    setBillableHours(prev => prev.filter(b => b.id !== id))
  }

  /** Drop a batch of rows from local state by id. Calendar.tsx uses
   *  this after its past-row cleanup pass (which converts assigned
   *  past blocks into project_activity before deleting them in DB). */
  const removeBillableHours = (ids: string[]): void => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    setBillableHours(prev => prev.filter(b => !idSet.has(b.id)))
  }

  /** Splice a batch of newly-inserted rows into local state. Used by
   *  the auto-placement util, which inserts directly via supabase and
   *  hands the resulting rows back to the caller. Avoids a refetch. */
  const appendBillableHours = (rows: BillableHour[]): void => {
    if (rows.length === 0) return
    setBillableHours(prev =>
      [...prev, ...rows].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
    )
  }

  // Derived stats. Whole-row discriminator: a row is either entirely
  // upcoming (start_time >= now) or counted as billed (start_time <
  // now). No row contributes to both. Same windowing for past
  // project_activity rows folded into "Billed 7d".
  const upcomingHoursToBill = useMemo(() => {
    const now = Date.now()
    const horizon = now + SEVEN_DAYS_MS
    return billableHours.reduce((sum, b) => {
      const start = new Date(b.start_time).getTime()
      if (start >= now && start < horizon) return sum + durationHours(b.start_time, b.end_time)
      return sum
    }, 0)
  }, [billableHours])

  const hoursBilledLast7Days = useMemo(() => {
    const now = Date.now()
    const windowStart = now - SEVEN_DAYS_MS
    const fromBillable = billableHours.reduce((sum, b) => {
      const start = new Date(b.start_time).getTime()
      if (start >= windowStart && start < now) return sum + durationHours(b.start_time, b.end_time)
      return sum
    }, 0)
    const fromExtras = pastBilledExtras.reduce((sum, e) => {
      const start = new Date(e.start_time).getTime()
      if (start >= windowStart && start < now) return sum + durationHours(e.start_time, e.end_time)
      return sum
    }, 0)
    return fromBillable + fromExtras
  }, [billableHours, pastBilledExtras])

  return {
    billableHours,
    loading,
    error,
    addBillableHour,
    updateBillableHour,
    deleteBillableHour,
    removeBillableHours,
    appendBillableHours,
    upcomingHoursToBill,
    hoursBilledLast7Days,
    refetch: fetchBillableHours,
  }
}
